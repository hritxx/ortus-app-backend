import { Injectable, BadRequestException, ForbiddenException, Logger, Inject } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { BseRestClient } from "./bse-rest.client";
import { BseSoapClient } from "./bse-soap.client";
import { BseSessionService } from "./bse-session.service";
import { mapOrderStatus } from "./bse-status.map";
import { NOTIFICATION_PORT, NotificationPort } from "./bse-notification.port";
import { UCC_DEFAULTS, FATCA_DEFAULTS } from "./bse.fields";

@Injectable()
export class BseService {
  private readonly logger = new Logger(BseService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly rest: BseRestClient,
    private readonly soap: BseSoapClient,
    private readonly session: BseSessionService,
    @Inject(NOTIFICATION_PORT) private readonly notify: NotificationPort,
  ) {}

  async onboard(userId: string): Promise<{ ucc: string; fatcaRegistered: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException("User not found");
    this.assertKycComplete(user);

    let ucc = user.bseUcc ?? undefined;
    let fatca = user.fatcaRegistered;

    if (!ucc) {
      const clientCode = userId.slice(-10).toUpperCase();           // VERIFY UCC format rules vs PDF
      const res = await this.rest.registerUcc({
        clientCode, firstName: user.name ?? "Investor", pan: user.panNumber!,
        holdingMode: UCC_DEFAULTS.holdingMode, taxStatus: UCC_DEFAULTS.taxStatus,
        bankAccount: user.bankAccount!, ifsc: user.ifscCode!,
        accountType: UCC_DEFAULTS.accountType, email: user.email, mobile: user.phone ?? "",
        allotmentMode: UCC_DEFAULTS.allotmentMode,
      });
      ucc = res.ucc;
    }
    if (!fatca) {
      await this.rest.registerFatca({ clientCode: ucc, pan: user.panNumber!, birthCountry: FATCA_DEFAULTS.birthCountry, taxResidency: FATCA_DEFAULTS.taxResidency });
      fatca = true;
    }
    await this.prisma.user.update({ where: { id: userId }, data: { bseUcc: ucc, fatcaRegistered: fatca } });
    return { ucc, fatcaRegistered: fatca };
  }

  async purchase(userId: string, dto: { schemeCode: string; schemeName: string; amount: number; type: "LUMPSUM" | "SIP" }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException("User not found");
    if (!user.bseUcc) throw new BadRequestException("Please complete onboarding before investing.");

    const token = await this.session.getToken("order");
    const { orderNumber } = await this.soap.placeOrder({
      token, ucc: user.bseUcc, schemeCode: dto.schemeCode, amount: dto.amount, buySell: "P", // VERIFY: BSE PDF (P = Purchase)
      orderType: dto.type,
    });

    const paymentUrl = await this.getPaymentUrl(orderNumber, user.bseUcc, dto.amount);
    const order = await this.prisma.mutualFundOrder.create({
      data: { userId, bseOrderNumber: orderNumber, schemeCode: dto.schemeCode, schemeName: dto.schemeName,
              amount: dto.amount, type: dto.type, status: "PENDING_PAYMENT", paymentUrl },
    });
    return { orderId: order.id, orderNumber, paymentUrl };
  }

  // Isolated so the payment-gateway call can be swapped/mocked. VERIFY vs BSE Payment Gateway service.
  // Placeholder ICCL redirect; becomes a real async BSE payment-gateway call (VERIFY: BSE PDF).
  private async getPaymentUrl(orderNumber: string, ucc: string, amount: number): Promise<string> {
    return `https://bsestarmfdemo.bseindia.com/pay?order=${orderNumber}&ucc=${ucc}&amt=${amount}`; // VERIFY: BSE PDF
  }

  async syncOrderStatus(orderId: string, userId?: string) {
    const order = await this.prisma.mutualFundOrder.findUnique({ where: { id: orderId } });
    if (!order?.bseOrderNumber) throw new BadRequestException("Order not found");
    if (userId && order.userId !== userId) throw new ForbiddenException();
    const token = await this.session.getToken("order");
    const raw = await this.soap.getOrderStatus(token, order.bseOrderNumber);
    const status = mapOrderStatus(raw);
    const updated = await this.prisma.mutualFundOrder.update({
      where: { id: orderId },
      data: { status, folioNumber: raw.folio ?? order.folioNumber, units: raw.units ?? order.units },
    });

    // Notify the investor on a terminal transition. Failures here must NOT fail
    // the sync — the status is already persisted above.
    if (status !== order.status && (status === "ALLOTTED" || status === "REJECTED")) {
      const scheme = order.schemeName ?? "Your fund";
      const title = status === "ALLOTTED" ? "Units allotted" : "Order rejected";
      const body =
        status === "ALLOTTED"
          ? `${scheme} units are now in your portfolio.`
          : `${scheme} could not be processed.`;
      try {
        await this.notify.pushToUser(order.userId, { title, body, data: { orderId: order.id } });
      } catch (e) {
        this.logger.warn(`order ${order.id} status push failed: ${(e as Error).message}`);
      }
    }

    return updated;
  }

  async listFunds(search?: string, category?: string) {
    return this.prisma.mfScheme.findMany({
      where: {
        ...(category ? { category } : {}),
        ...(search ? { schemeName: { contains: search, mode: "insensitive" } } : {}),
      },
      take: 50,
      orderBy: { schemeName: "asc" },
    });
  }

  private assertKycComplete(user: any): void {
    const missing = ["panNumber", "bankAccount", "ifscCode"].filter((f) => !user[f]);
    if (missing.length) throw new BadRequestException(`Complete your KYC first (missing: ${missing.join(", ")})`);
  }
}
