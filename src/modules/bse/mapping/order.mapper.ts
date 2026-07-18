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
  return { data: { id: bseOrderNumber, filter_param: { open_close: "o" } } };
}
