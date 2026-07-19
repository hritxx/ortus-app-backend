import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../common/prisma/prisma.service";
import { BseOrderService } from "../services/bse-order.service";

/**
 * Consumes BSE StAR MF v2 webhooks (BSE Webhook Sequence doc). BSE POSTs one-sided events;
 * we ACK with JSON 200 to avoid retry flooding. Callback shape:
 *   { member, request_id, investor:{ client_code }, action:{ event_type, event, order_id?, mem_ord_ref_id? } }
 */
@Injectable()
export class BseWebhookService {
  private readonly logger = new Logger(BseWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: BseOrderService,
  ) {}

  async handle(body: any): Promise<{ status: string }> {
    const action = body?.action ?? {};
    const eventType = String(action.event_type ?? "").toUpperCase();
    try {
      if (eventType === "UCC") await this.handleUcc(body, action);
      else if (eventType === "ORDER") await this.handleOrder(body, action);
      else this.logger.log(`Unhandled webhook event_type: ${eventType || "(none)"}`);
    } catch (e) {
      // Never fail the webhook — log and ACK so BSE doesn't retry-flood.
      this.logger.error(`webhook handling error (${eventType}): ${(e as Error).message}`);
    }
    return { status: "ok" };
  }

  /** UCC lifecycle → mark the user's UCC ACTIVE (transaction-ready) when BSE says so. */
  private async handleUcc(body: any, action: any): Promise<void> {
    const clientCode = body?.investor?.client_code;
    if (!clientCode) return;
    const event = String(action.event ?? "").toUpperCase();
    // Terminal/meaningful UCC states we persist verbatim; ACTIVE unlocks ordering.
    const status = event === "SUSPENDED" ? "SUSPENDED" : event === "ACTIVE" ? "ACTIVE" : event;
    await this.prisma.user.updateMany({
      where: { bseUcc: clientCode },
      data: { bseUccStatus: status },
    });
    this.logger.log(`UCC ${clientCode} → ${status}`);
  }

  /** ORDER lifecycle → resync the order (order_get) which also updates holdings + notifies. */
  private async handleOrder(body: any, action: any): Promise<void> {
    const orderId = action.order_id != null ? String(action.order_id) : undefined;
    const memRef = action.mem_ord_ref_id != null ? String(action.mem_ord_ref_id) : undefined;
    const order = await this.prisma.mutualFundOrder.findFirst({
      where: {
        OR: [
          ...(orderId ? [{ bseOrderNumber: orderId }] : []),
          ...(memRef ? [{ memOrdRefId: memRef }] : []),
        ],
      },
    });
    if (!order) {
      this.logger.warn(`ORDER webhook for unknown order (id=${orderId}, ref=${memRef})`);
      return;
    }
    await this.orders.syncOrderStatus(order.id); // trusted system caller (no userId)
  }
}
