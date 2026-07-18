import { Injectable, Logger } from "@nestjs/common";
import { ExchPgClient } from "../sdk/exch-pg.client";
import { BseConfig } from "../bse.config";

/**
 * Wraps the exchange payment gateway for the buy flow.
 * CONFIRM IN UAT: the exact get_exchpg_service request shape (fields below are best-effort).
 */
@Injectable()
export class BsePaymentService {
  private readonly logger = new Logger(BsePaymentService.name);

  constructor(
    private readonly exchPg: ExchPgClient,
    private readonly cfg: BseConfig,
  ) {}

  /** Returns the payment redirect URL for a placed buy order. */
  async getPaymentUrl(
    bseOrderNumber: string,
    ucc: string,
    amount: number,
  ): Promise<{ paymentUrl: string; paymentRefId?: string }> {
    const payload = {
      data: {
        order_id: bseOrderNumber,
        client_code: ucc,
        member: this.cfg.memberCode,
        amount,
        mode: "NET", // CONFIRM IN UAT: payment mode enum
      },
    };
    const { redirectUrl, raw } = await this.exchPg.getExchPgService(payload);
    const paymentRefId = raw?.data?.payment_ref_id ?? raw?.payment_ref_id;
    return { paymentUrl: redirectUrl, paymentRefId };
  }

  /** Confirms a completed payment back to the exchange. */
  async confirmPayment(payload: unknown): Promise<any> {
    return this.exchPg.sendPaymentInfo(payload);
  }

  async getPaymentStatus(bseOrderNumber: string): Promise<any> {
    return this.exchPg.getPgPaymentStatus({ data: { order_id: bseOrderNumber } });
  }
}
