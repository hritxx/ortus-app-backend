import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class BseConfig {
  constructor(private readonly config: ConfigService) {}

  get env(): "uat" | "prod" {
    return this.config.get<string>("BSE_ENV") === "prod" ? "prod" : "uat";
  }
  get memberCode(): string { return this.config.get<string>("BSE_MEMBER_CODE"); }
  get userId(): string { return this.config.get<string>("BSE_USER_ID"); }
  get password(): string { return this.config.get<string>("BSE_PASSWORD"); }

  // Endpoints differ by env. UAT host: https://bsestarmfdemo.bseindia.com
  get soapOrderUrl(): string {
    return this.config.get<string>("BSE_SOAP_ORDER_URL");   // VERIFY: BSE PDF (MFOrder.svc)
  }
  get restBaseUrl(): string {
    return this.config.get<string>("BSE_REST_BASE_URL");    // VERIFY: BSE PDF (StarMFCommonAPI)
  }

  assertConfigured(): void {
    const missing = ["BSE_MEMBER_CODE", "BSE_USER_ID", "BSE_PASSWORD", "BSE_SOAP_ORDER_URL", "BSE_REST_BASE_URL"]
      .filter((k) => !this.config.get<string>(k));
    if (missing.length) {
      throw new InternalServerErrorException(`BSE config missing: ${missing.join(", ")}`);
    }
  }

  // Safe to log / expose in a health check — NO secrets.
  toSafeJSON() {
    return { env: this.env, memberCode: this.memberCode ? "set" : "missing", soapConfigured: !!this.soapOrderUrl };
  }
}
