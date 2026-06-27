// VERIFY full field set against BSE API File Structure PDF before go-live.
export interface UccPayload {
  clientCode: string;
  firstName: string;
  pan: string;
  holdingMode: "SI" | "JO" | "AS";
  taxStatus: string;
  bankAccount: string;
  ifsc: string;
  accountType: "SB" | "CB";
  email: string;
  mobile: string;
  allotmentMode: "DEMAT" | "PHYSICAL";
}

export interface FatcaPayload {
  clientCode: string;
  pan: string;
  birthCountry: string;
  taxResidency: string;
}
