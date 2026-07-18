import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * All BSE StAR MF v2 configuration. The SDK appends `/api` + endpoint to baseUrl,
 * so baseUrl is the bare host (e.g. https://starmfv2demo.bseindia.com).
 */
@Injectable()
export class BseConfig {
  constructor(private readonly config: ConfigService) {}

  get env(): "uat" | "prod" {
    return this.config.get<string>("BSE_ENV") === "prod" ? "prod" : "uat";
  }

  // Bare host; SDK builds `${baseUrl}/api${endpoint}`.
  get baseUrl(): string {
    return this.config.get<string>("BSE_BASE_URL") ?? "https://starmfv2demo.bseindia.com";
  }

  // Member login username, format: member/<code>/<name> (e.g. member/66881/ortusfinanceprivatelimited)
  get username(): string {
    return this.config.get<string>("BSE_USERNAME") ?? "";
  }
  get password(): string {
    return this.config.get<string>("BSE_PASSWORD") ?? "";
  }
  // Numeric member code used inside order/UCC payloads (the <code> segment).
  get memberCode(): string {
    return this.config.get<string>("BSE_MEMBER_CODE") ?? "";
  }

  // Session token cache TTL. BSE tokens are short-lived; default conservative 20 min.
  get tokenTtlMs(): number {
    const raw = this.config.get<string>("BSE_TOKEN_TTL_MS");
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 20 * 60 * 1000;
  }

  // Production requires JOSE encryption; UAT/demo accepts plaintext. Off unless explicitly enabled.
  get encryptionEnabled(): boolean {
    return this.config.get<string>("BSE_ENCRYPTION") === "true";
  }

  assertConfigured(): void {
    const missing = ["BSE_BASE_URL", "BSE_USERNAME", "BSE_PASSWORD", "BSE_MEMBER_CODE"].filter(
      (k) => !this.config.get<string>(k),
    );
    if (missing.length) {
      throw new InternalServerErrorException(`BSE config missing: ${missing.join(", ")}`);
    }
  }

  // Safe to log / expose in a health check — NO secrets.
  toSafeJSON() {
    return {
      env: this.env,
      baseUrl: this.baseUrl,
      memberCode: this.memberCode ? "set" : "missing",
      username: this.username ? "set" : "missing",
      encryptionEnabled: this.encryptionEnabled,
    };
  }
}
