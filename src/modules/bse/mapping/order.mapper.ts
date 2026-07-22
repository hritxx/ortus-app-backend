/**
 * Maps our internal order intent to a BSE StAR MF v2 /order_new payload.
 * Buy = type "p" (purchase); Sell/redeem = type "r".
 *
 * CONFIRM IN UAT: field names/enums follow the Postman "order_new_purchase"
 * and "order_new_redeem" examples. Keep BSE-specific names centralized here.
 */

export interface OrderMapInput {
  side: "BUY" | "SELL";
  ucc: string;
  member: string;
  scheme: string;
  memOrdRefId: string;
  email: string;
  mobile: string;
  amount?: number; // required for BUY, optional (amount-based) for SELL
  units?: number; // SELL by units
  allUnits?: boolean; // SELL all
  folio?: string; // required for SELL
}

export function buildOrderNewPayload(input: OrderMapInput) {
  const isSell = input.side === "SELL";
  return {
    data: {
      orders: [
        {
          type: isSell ? "r" : "p",
          mem_ord_ref_id: input.memOrdRefId,
          investor: { ucc: input.ucc },
          member: input.member,
          scheme: input.scheme,
          amount: isSell ? (input.amount ?? 0) : input.amount,
          cur: "INR",
          is_units: isSell ? Boolean(input.units) && !input.allUnits : false,
          all_units: isSell ? Boolean(input.allUnits) : false,
          units: isSell ? (input.units ?? 0) : 0,
          min_redeem_flag: false,
          folio: input.folio ?? "",
          is_fresh: !isSell,
          phys_or_demat: "P",
          src: isSell ? "redemption" : "lumpsum",
          email: input.email,
          mobnum: input.mobile,
          kyc_passed: true,
        },
      ],
    },
  };
}

export function buildOrderGetPayload(bseOrderNumber: string) {
  // BSE order_get requires `id` as a NUMBER — a string id returns `invalid_json` (622).
  // Verified live in UAT (2026-07-22); filter_param is optional so we omit it.
  const id = Number(bseOrderNumber);
  return { data: { id: Number.isFinite(id) ? id : bseOrderNumber } };
}

export interface OrderListInput {
  member: string;
  ucc?: string; // optional: scope to one investor; omit for all member orders
  openClose?: "o" | "c"; // "o" open, "c" closed; default open
  start?: number;
  length?: number;
}

export function buildOrderListPayload(input: OrderListInput) {
  // BSE order_list requires `fields` (bare call → `522 required "Fields"`). "ALL" returns the
  // full order record; results come back under `data.lists`. Verified live in UAT (2026-07-22).
  return {
    data: {
      member: input.member,
      ...(input.ucc ? { investor: { ucc: input.ucc } } : {}),
      fields: ["ALL"],
      start: input.start ?? 0,
      length: input.length ?? 100,
      filter_param: { open_close: input.openClose ?? "o" },
    },
  };
}
