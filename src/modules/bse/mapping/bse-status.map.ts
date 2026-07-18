import { MfOrderStatus } from "@prisma/client";

/**
 * Normalizes a BSE v2 order_get response into our MfOrderStatus.
 *
 * CONFIRM IN UAT: the raw string values BSE returns for order/payment/allotment state.
 * Keep this the single mapping point. `side` lets a redeemed sell map to REDEEMED
 * rather than ALLOTTED.
 */
export function mapOrderStatus(
  raw: {
    orderStatus?: string;
    paymentStatus?: string;
    allotted?: boolean;
    redeemed?: boolean;
  },
  side: "BUY" | "SELL" = "BUY",
): MfOrderStatus {
  const os = (raw.orderStatus ?? "").toUpperCase();

  if (raw.redeemed || os === "REDEEMED") return "REDEEMED";
  if (raw.allotted || os === "ALLOTTED") return side === "SELL" ? "REDEEMED" : "ALLOTTED";
  if (os === "REJECTED") return "REJECTED";
  if (os === "CANCELLED") return "CANCELLED";
  if ((raw.paymentStatus ?? "").toUpperCase() === "PAID") return "PAID";
  if (os === "PROCESSING") return "PROCESSING";

  // Sells never wait on a payment; default them to PROCESSING, buys to PENDING_PAYMENT.
  return side === "SELL" ? "PROCESSING" : "PENDING_PAYMENT";
}
