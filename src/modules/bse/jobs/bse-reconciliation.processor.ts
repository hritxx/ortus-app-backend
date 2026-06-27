/**
 * BseReconciliationProcessor
 *
 * Finds all non-terminal mutual fund orders and either:
 *   - Auto-cancels PENDING_PAYMENT orders that have passed the T+1 09:30 BSE cutoff, or
 *   - Calls BseService.syncOrderStatus (trusted system caller — no userId) for all others.
 *
 * SCHEDULING DEFERRED: Wire `reconcileOpenOrders` to a BullMQ repeatable job (every ~30 min)
 * or a `@nestjs/schedule` `@Cron`, market-day aware, once Redis is provisioned.
 * This is an integration step requiring Redis + the BSE market calendar.
 */
import { Injectable, Logger } from "@nestjs/common";
import { MfOrderStatus } from "@prisma/client";
import { PrismaService } from "../../../common/prisma/prisma.service";
import { BseService } from "../bse.service";

const TERMINAL = [MfOrderStatus.ALLOTTED, MfOrderStatus.REJECTED, MfOrderStatus.CANCELLED];

@Injectable()
export class BseReconciliationProcessor {
  private readonly logger = new Logger(BseReconciliationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bse: BseService,
  ) {}

  async reconcileOpenOrders(now: Date): Promise<{ checked: number; autoCancelled: number }> {
    const open = await this.prisma.mutualFundOrder.findMany({
      where: { status: { notIn: TERMINAL } },
    });

    let autoCancelled = 0;

    for (const order of open) {
      if (order.status === "PENDING_PAYMENT" && this.pastPaymentCutoff(order.createdAt, now)) {
        await this.prisma.mutualFundOrder.update({
          where: { id: order.id },
          data: {
            status: "CANCELLED",
            bseRemarks: "Auto-cancelled: payment not received by T+1 cutoff",
          },
        });
        autoCancelled++;
        continue;
      }

      try {
        // Trusted system caller — no userId, ownership check intentionally skipped.
        await this.bse.syncOrderStatus(order.id);
      } catch (e) {
        this.logger.warn(`reconcile ${order.id} failed: ${(e as Error).message}`);
      }
    }

    return { checked: open.length, autoCancelled };
  }

  /**
   * T+1 09:30 simplified to >24 h for now.
   * Refine with the BSE market calendar once available. VERIFY before prod.
   */
  private pastPaymentCutoff(createdAt: Date, now: Date): boolean {
    return now.getTime() - createdAt.getTime() > 24 * 3600 * 1000;
  }
}
