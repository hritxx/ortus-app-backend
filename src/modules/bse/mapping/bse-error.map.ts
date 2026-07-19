import { HttpException, HttpStatus } from "@nestjs/common";

export class BseError extends HttpException {
  constructor(
    public readonly bseCode: string,
    public readonly userMessage: string,
    rawMessage?: string,
  ) {
    super({ bseCode, message: userMessage, raw: rawMessage }, HttpStatus.BAD_GATEWAY);
  }
}

// CONFIRM IN UAT: numeric/string codes below are best-effort. Capture real codes via
// scripts/bse-uat-smoke.ts and extend this table — it is the single source of truth.
const CODE_TO_MESSAGE: Record<string, string> = {
  "401": "We couldn't authenticate with the exchange. Please try again.",
  "100": "We couldn't authenticate with the exchange. Please try again.",
  "101": "Your KYC is not yet complete with the exchange.",
  BSE_KYC_PENDING: "Your KYC is not yet complete with the exchange.",
  BSE_UCC_EXISTS: "This client is already registered with the exchange.",
  BSE_INSUFFICIENT_UNITS: "You don't have enough units to redeem.",
};

export function mapBseError(rawCode: string, rawMessage?: string): never {
  const userMessage =
    CODE_TO_MESSAGE[rawCode] ?? "Something went wrong talking to the exchange. Please try again.";
  throw new BseError(rawCode, userMessage, rawMessage);
}

/**
 * The BSE v2 SDK returns the raw response body (never throws). The real UAT envelope is:
 *   success: { status: "success", data: {...}, messages: [...] }
 *   error:   { status: "error", data: null, messages: [{ msgid, errcode, field, vals }] }
 * (verified against the live demo, 2026-07-19). We throw a BseError on `status:"error"`,
 * surfacing the field-level messages, and also handle HTTP-style error bodies defensively
 * (used by the direct exch-pg client calls).
 */
export function normalizeBseResponse<T = any>(resp: any): T {
  if (resp == null) {
    mapBseError("EMPTY", "The exchange returned an empty response.");
  }

  // v2 native error envelope.
  if (resp.status === "error" || resp.success === false) {
    const messages: any[] = Array.isArray(resp.messages) ? resp.messages : [];
    const detail = messages
      .map((m) => {
        const val = Array.isArray(m?.vals) ? m.vals.filter(Boolean).join(" ") : "";
        return [m?.field, m?.errcode, val].filter(Boolean).join(": ");
      })
      .filter(Boolean)
      .join("; ");
    const code = String(messages[0]?.errcode ?? messages[0]?.msgid ?? resp.code ?? "error");
    mapBseError(code, detail || resp.errorMsg || resp.error || undefined);
  }

  // Defensive: HTTP-style error bodies (e.g. from direct axios calls).
  const httpStatus = resp.httpStatus ?? (typeof resp.status === "number" ? resp.status : undefined);
  if (
    (typeof httpStatus === "number" && httpStatus >= 400) ||
    typeof resp.errorMsg === "string" ||
    typeof resp.error === "string"
  ) {
    mapBseError(String(resp.code ?? httpStatus ?? "unknown"), resp.errorMsg ?? resp.error);
  }

  return resp as T;
}
