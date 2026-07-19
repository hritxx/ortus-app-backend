import { MfOrderStatus } from "@prisma/client";

/**
 * Maps a BSE v2 order-lifecycle status/event string to our MfOrderStatus.
 * Vocabulary is shared between order_get `status` and ORDER webhook `event`
 * (BSE Webhook Sequence doc — physical & demat lumpsum/redemption flows).
 * `side` disambiguates the terminal `done` event (BUY→ALLOTTED, SELL→REDEEMED).
 */
const PENDING_PAYMENT = new Set(["payment_pending", "bank_tpv_pending"]);
const PROCESSING = new Set([
  "received",
  "order_2fa_pending",
  "match_pending",
  "matched",
  "sent_to_rta",
  "queued_for_rta",
  "queued_to_rta",
  "rta_reprocess",
  "rta_resp_rcvd",
  "units_payout_sent",
  "queued_for_dp",
  "cff_validation_pending",
  "units_pool_init",
  "units_pull_completed",
  "units_pool_completed",
  "units_rcpt_in_sent",
  "amc_mis_pending",
  "red_matched",
  "threshold_approval_pending",
]);
const ALLOTTED = new Set(["units_rta_settled", "dp_units_matched", "partial_units_matched"]);
const REDEEMED = new Set(["redempt_rta_settled", "redempt_payout_attempted", "amc_mis_payout_updated"]);
const REJECTED = new Set([
  "rta_rejected",
  "dep_rejected",
  "platform_rejected",
  "ops_rejected",
  "redempt_payout_failed",
  "redempt_fund_returned_amc",
]);
const CANCELLED = new Set(["cancelled", "canceled"]);

export function mapOrderStatus(
  raw: { status?: string; orderStatus?: string; allotted?: boolean; redeemed?: boolean },
  side: "BUY" | "SELL" = "BUY",
): MfOrderStatus {
  const s = (raw.status ?? raw.orderStatus ?? "").toLowerCase();

  if (raw.redeemed || REDEEMED.has(s)) return "REDEEMED";
  if (raw.allotted || ALLOTTED.has(s)) return side === "SELL" ? "REDEEMED" : "ALLOTTED";
  if (REJECTED.has(s)) return "REJECTED";
  if (CANCELLED.has(s)) return "CANCELLED";
  if (s === "done") return side === "SELL" ? "REDEEMED" : "ALLOTTED";
  if (PENDING_PAYMENT.has(s)) return "PENDING_PAYMENT";
  if (PROCESSING.has(s)) return "PROCESSING";

  // Unknown/interim: sells never wait on payment; buys default to pending payment.
  return side === "SELL" ? "PROCESSING" : "PENDING_PAYMENT";
}
