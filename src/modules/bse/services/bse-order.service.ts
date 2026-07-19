import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { randomInt } from "crypto";
import { PrismaService } from "../../../common/prisma/prisma.service";
import { BseSdkClient } from "../sdk/bse-sdk.client";
import { BseConfig } from "../bse.config";
import { BseHoldingService } from "./bse-holding.service";
import { BsePaymentService } from "./bse-payment.service";
import { buildOrderNewPayload, buildOrderGetPayload } from "../mapping/order.mapper";
import { mapOrderStatus } from "../mapping/bse-status.map";
import { NOTIFICATION_PORT, NotificationPort } from "../bse-notification.port";

export interface PurchaseInput {
  schemeCode: string;
  schemeName: string;
  amount: number;
  type?: "LUMPSUM" | "SIP";
  idempotencyKey?: string;
}
export interface RedeemInput {
  schemeCode: string;
  schemeName?: string;
  folioNumber: string;
  units?: number;
  allUnits?: boolean;
  idempotencyKey?: string;
}

@Injectable()
export class BseOrderService {
  private readonly logger = new Logger(BseOrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sdk: BseSdkClient,
    private readonly cfg: BseConfig,
    private readonly holdings: BseHoldingService,
    private readonly payment: BsePaymentService,
    @Inject(NOTIFICATION_PORT) private readonly notify: NotificationPort,
  ) {}

  async purchase(userId: string, dto: PurchaseInput) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException("User not found");
    if (!user.bseUcc) throw new BadRequestException("Please complete onboarding before investing.");

    // Idempotency: a repeated request with the same key returns the existing order.
    if (dto.idempotencyKey) {
      const existing = await this.prisma.mutualFundOrder.findUnique({
        where: { memOrdRefId: dto.idempotencyKey },
      });
      if (existing) {
        return {
          orderId: existing.id,
          orderNumber: existing.bseOrderNumber,
          paymentUrl: existing.paymentUrl,
        };
      }
    }

    const memOrdRefId = dto.idempotencyKey ?? this.genNumericRef();
    // Persist BEFORE the BSE call so a retry can't double-place.
    const order = await this.prisma.mutualFundOrder.create({
      data: {
        userId,
        memOrdRefId,
        side: "BUY",
        schemeCode: dto.schemeCode,
        schemeName: dto.schemeName,
        amount: dto.amount,
        type: dto.type ?? "LUMPSUM",
        status: "PENDING_PAYMENT",
      },
    });

    const resp = await this.sdk.orderNew(
      buildOrderNewPayload({
        side: "BUY",
        ucc: user.bseUcc,
        member: this.cfg.memberCode,
        scheme: dto.schemeCode,
        amount: dto.amount,
        memOrdRefId,
        email: user.email,
        mobile: user.phone ?? "",
      }),
    );
    const orderNumber = this.extractOrderNumber(resp);

    const { paymentUrl, paymentRefId } = await this.payment.getPaymentUrl(
      orderNumber,
      user.bseUcc,
      dto.amount,
    );

    const updated = await this.prisma.mutualFundOrder.update({
      where: { id: order.id },
      data: { bseOrderNumber: orderNumber, paymentUrl, paymentRefId },
    });
    return { orderId: updated.id, orderNumber, paymentUrl };
  }

  async redeem(userId: string, dto: RedeemInput) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.bseUcc) throw new BadRequestException("Please complete onboarding first.");

    const holding = await this.holdings.getHolding(userId, dto.schemeCode, dto.folioNumber);
    if (!holding) throw new BadRequestException("You don't hold units in this scheme/folio.");
    if (!dto.allUnits) {
      if (!dto.units || dto.units <= 0) throw new BadRequestException("Enter units to redeem.");
      if (dto.units > holding.units) {
        throw new BadRequestException(`You only hold ${holding.units} units.`);
      }
    }

    if (dto.idempotencyKey) {
      const existing = await this.prisma.mutualFundOrder.findUnique({
        where: { memOrdRefId: dto.idempotencyKey },
      });
      if (existing) return { orderId: existing.id, orderNumber: existing.bseOrderNumber };
    }

    const memOrdRefId = dto.idempotencyKey ?? this.genNumericRef();
    const order = await this.prisma.mutualFundOrder.create({
      data: {
        userId,
        memOrdRefId,
        side: "SELL",
        schemeCode: dto.schemeCode,
        schemeName: dto.schemeName ?? holding.schemeName,
        units: dto.units,
        allUnits: Boolean(dto.allUnits),
        folioNumber: dto.folioNumber,
        type: "LUMPSUM",
        status: "PROCESSING",
      },
    });

    const resp = await this.sdk.orderNew(
      buildOrderNewPayload({
        side: "SELL",
        ucc: user.bseUcc,
        member: this.cfg.memberCode,
        scheme: dto.schemeCode,
        units: dto.units,
        allUnits: dto.allUnits,
        folio: dto.folioNumber,
        memOrdRefId,
        email: user.email,
        mobile: user.phone ?? "",
      }),
    );
    const orderNumber = this.extractOrderNumber(resp);

    const updated = await this.prisma.mutualFundOrder.update({
      where: { id: order.id },
      data: { bseOrderNumber: orderNumber },
    });
    return { orderId: updated.id, orderNumber };
  }

  async syncOrderStatus(orderId: string, userId?: string) {
    const order = await this.prisma.mutualFundOrder.findUnique({ where: { id: orderId } });
    if (!order?.bseOrderNumber) throw new BadRequestException("Order not found");
    if (userId && order.userId !== userId) throw new ForbiddenException();

    const resp = await this.sdk.orderGet(buildOrderGetPayload(order.bseOrderNumber));
    const raw = this.extractStatusFields(resp);
    const status = mapOrderStatus(raw, order.side as "BUY" | "SELL");

    const data = {
      status,
      folioNumber: raw.folio ?? order.folioNumber,
      units: raw.units ?? order.units,
      bseRemarks: raw.remarks ?? order.bseRemarks,
    };
    const updated = await this.prisma.mutualFundOrder.update({ where: { id: orderId }, data });

    if (status !== order.status) {
      // Merge to guarantee a complete row (immutable fields from `order`, fresh fields from `data`).
      await this.onTerminalTransition({ ...order, ...data }, status, raw);
    }
    return updated;
  }

  private async onTerminalTransition(order: any, status: string, raw: any) {
    const user = await this.prisma.user.findUnique({ where: { id: order.userId } });
    const ucc = user?.bseUcc ?? "";

    try {
      if (status === "ALLOTTED" && order.side === "BUY" && order.folioNumber && order.units) {
        await this.holdings.upsertFromAllotment({
          userId: order.userId,
          ucc,
          schemeCode: order.schemeCode,
          schemeName: order.schemeName,
          folioNumber: order.folioNumber,
          units: order.units,
          nav: raw.nav,
        });
      }
      if (status === "REDEEMED" && order.side === "SELL" && order.folioNumber) {
        await this.holdings.decrementOnRedeem({
          ucc,
          schemeCode: order.schemeCode,
          folioNumber: order.folioNumber,
          units: order.units ?? undefined,
          allUnits: order.allUnits,
        });
      }
    } catch (e) {
      this.logger.warn(`holding update failed for order ${order.id}: ${(e as Error).message}`);
    }

    if (["ALLOTTED", "REDEEMED", "REJECTED"].includes(status)) {
      const scheme = order.schemeName ?? "Your fund";
      const map: Record<string, { title: string; body: string }> = {
        ALLOTTED: { title: "Units allotted", body: `${scheme} units are now in your portfolio.` },
        REDEEMED: { title: "Redemption processed", body: `${scheme} redemption is complete.` },
        REJECTED: { title: "Order rejected", body: `${scheme} could not be processed.` },
      };
      try {
        await this.notify.pushToUser(order.userId, { ...map[status], data: { orderId: order.id } });
      } catch (e) {
        this.logger.warn(`order ${order.id} status push failed: ${(e as Error).message}`);
      }
    }
  }

  listOrders(userId: string) {
    return this.prisma.mutualFundOrder.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  // BSE requires mem_ord_ref_id to be NUMERIC (verified on UAT: alphanumeric/UUID is rejected
  // with errcode "invalid"). Generate a unique numeric ref: 13-digit epoch + 4 random digits.
  private genNumericRef(): string {
    return `${Date.now()}${randomInt(1000, 9999)}`;
  }

  // order_new success returns { data: { items: [{ mem_ord_ref_id, id }] } } (BSE order id).
  private extractOrderNumber(resp: any): string {
    const d = resp?.data ?? resp;
    const items = d?.items ?? d?.orders ?? [];
    const first = Array.isArray(items) ? items[0] : items;
    const num = first?.id ?? first?.order_id ?? d?.id ?? d?.order_id;
    if (num == null) {
      throw new InternalServerErrorException("BSE returned success but no order number");
    }
    return String(num);
  }

  // order_get returns the order object directly under `data`, with `status`
  // (order_lifecycle event), `folio_num`, `allotment_details`, `redempt_details`.
  private extractStatusFields(resp: any): {
    status?: string;
    allotted?: boolean;
    redeemed?: boolean;
    folio?: string;
    units?: number;
    nav?: number;
    remarks?: string;
  } {
    const o = resp?.data ?? resp ?? {};
    const allot = o?.allotment_details ?? {};
    const redeem = o?.redempt_details ?? {};
    const units = allot?.units ?? allot?.alloted_units ?? redeem?.units;
    const nav = allot?.nav ?? allot?.alloted_nav;
    return {
      status: o?.status,
      folio: o?.folio_num ?? allot?.folio_num ?? undefined,
      units: units != null ? Number(units) : undefined,
      nav: nav != null ? Number(nav) : undefined,
      remarks: o?.remarks ?? o?.rta_remark ?? (o?.rejection_reason?.reason ?? undefined),
    };
  }
}
