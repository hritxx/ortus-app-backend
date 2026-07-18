import { Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { BseConfig } from "../bse.config";
import { BseSdkClient } from "./bse-sdk.client";
import { normalizeBseResponse } from "../mapping/bse-error.map";

/**
 * Payment-gateway client. The official SDK does NOT implement the exchange PG endpoints
 * (get_exchpg_service / send_payment_info / get_bse_pg_payment_status), so we call them
 * directly here — the redirect URL from get_exchpg_service is the core of "buy".
 *
 * CONFIRM IN UAT: request/response field names against the Postman "Payment & Gateway"
 * folder and the EncryptDecrypt PDF. All BSE-specific field access is centralized here.
 */
const EXCHPG_RESPONSE_URL_FIELDS = ["redirect_url", "redirectUrl", "url", "payment_url"];

@Injectable()
export class ExchPgClient {
  private readonly logger = new Logger(ExchPgClient.name);

  constructor(
    private readonly http: HttpService,
    private readonly cfg: BseConfig,
    private readonly sdk: BseSdkClient,
  ) {}

  private url(endpoint: string): string {
    return `${this.cfg.baseUrl}/api${endpoint}`;
  }

  private async authHeaders() {
    const token = await this.sdk.getToken();
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  }

  async getExchPgService(payload: unknown): Promise<{ redirectUrl: string; raw: any }> {
    const headers = await this.authHeaders();
    const { data } = await firstValueFrom(
      this.http.post(this.url("/get_exchpg_service"), payload, { headers }),
    );
    const body = normalizeBseResponse<any>(data);
    const src = body?.data ?? body;
    const redirectUrl = EXCHPG_RESPONSE_URL_FIELDS.map((f) => src?.[f]).find(Boolean);
    return { redirectUrl, raw: body };
  }

  async sendPaymentInfo(payload: unknown): Promise<any> {
    const headers = await this.authHeaders();
    const { data } = await firstValueFrom(
      this.http.post(this.url("/send_payment_info"), payload, { headers }),
    );
    return normalizeBseResponse(data);
  }

  async getPgPaymentStatus(payload: unknown): Promise<any> {
    const headers = await this.authHeaders();
    const { data } = await firstValueFrom(
      this.http.post(this.url("/get_bse_pg_payment_status"), payload, { headers }),
    );
    return normalizeBseResponse(data);
  }
}
