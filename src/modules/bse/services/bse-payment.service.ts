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

  // Deep link the exchange PG redirects back to after payment (resumed by the app).
  private static readonly RETURN_URL = "ortus-finance://payment-return";

  /**
   * Returns the payment redirect URL for a placed buy order.
   * Payload shape verified against the BSE v2 Postman "get_exchpg_service" sample:
   * mem_details + investor.ucc + order_ids[] + requested_method + payment_mode[].
   * (`amount` is not part of this request; kept in the signature for call-site clarity.)
   */
  async getPaymentUrl(
    bseOrderNumber: string,
    ucc: string,
    _amount?: number,
  ): Promise<{ paymentUrl: string; paymentRefId?: string }> {
    const orderId = Number(bseOrderNumber);
    const payload = {
      data: {
        mem_details: {
          member: this.cfg.memberCode,
          euin: "",
          euin_flag: false,
          sub_br_code: "",
          sub_br_arn: "",
          partner_id: "",
        },
        investor: { ucc },
        order_ids: [Number.isFinite(orderId) ? orderId : bseOrderNumber],
        requested_method: "exch_pg_page", // vs "payment_info_data"
        payment_mode: ["upi", "netbanking", "mandate"],
        redirection_url: BsePaymentService.RETURN_URL,
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
