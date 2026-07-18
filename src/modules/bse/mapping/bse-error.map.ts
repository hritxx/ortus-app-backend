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
 * The BSE v2 SDK returns the raw response body (never throws). BSE wraps payloads under a
 * top-level `data` key and reports failure via a status/message field. We treat a response
 * as an error when it carries an explicit error signal; otherwise we pass the body through.
 *
 * CONFIRM IN UAT: the exact success/error envelope. Adjust the predicates below once the
 * smoke script records real responses.
 */
export function normalizeBseResponse<T = any>(resp: any): T {
  if (resp == null) {
    mapBseError("EMPTY", "The exchange returned an empty response.");
  }

  const errorMsg = resp.errorMsg ?? resp.error ?? resp.message;
  const status = resp.status ?? resp.Status ?? resp.httpStatus;

  const looksLikeError =
    typeof resp.errorMsg === "string" ||
    typeof resp.error === "string" ||
    (typeof status === "number" && status >= 400) ||
    (typeof status === "string" && /^(4|5)\d\d$/.test(status)) ||
    resp.success === false;

  if (looksLikeError) {
    const code = String(resp.code ?? resp.Status ?? status ?? "unknown");
    mapBseError(code, typeof errorMsg === "string" ? errorMsg : undefined);
  }

  return resp as T;
}
