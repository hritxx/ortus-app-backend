import { MfOrderStatus } from "@prisma/client";

// VERIFY raw string values vs BSE Order Status / Funds Received report codes.
export function mapOrderStatus(raw: { orderStatus?: string; paymentStatus?: string; allotted?: boolean }): MfOrderStatus {
  if (raw.allotted) return "ALLOTTED";
  if (raw.orderStatus === "REJECTED") return "REJECTED";
  if (raw.orderStatus === "CANCELLED") return "CANCELLED";
  if (raw.paymentStatus === "PAID") return "PAID";
  if (raw.orderStatus === "PROCESSING") return "PROCESSING";
  return "PENDING_PAYMENT";
}
