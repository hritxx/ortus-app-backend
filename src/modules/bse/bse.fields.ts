// VERIFY EVERY VALUE against the BSE API File Structure PDF. This file is the only
// place BSE-specific names live, so spec revisions are a one-file change.
export const SOAP = {
  orderEntryMethod: "orderEntryParam",    // VERIFY
  responseDelimiter: "|",                 // BSE often returns pipe-delimited "code|message|payload" // VERIFY
};
export const REST = {
  uccRegistration: "/ClientMaster/Registration", // VERIFY (StarMFCommonAPI)
  fatcaRegistration: "/FatcaRegistration",        // VERIFY
};

// Default UCC field codes. VERIFY every value against the BSE API File Structure PDF.
export const UCC_DEFAULTS = {
  holdingMode: "SI" as const,      // VERIFY: BSE PDF (holding nature)
  taxStatus: "01" as const,        // VERIFY: BSE PDF (resident individual)
  accountType: "SB" as const,      // VERIFY: BSE PDF (savings)
  allotmentMode: "PHYSICAL" as const, // VERIFY: BSE PDF (vs DEMAT)
};
export const FATCA_DEFAULTS = {
  birthCountry: "IN" as const,     // VERIFY: BSE PDF
  taxResidency: "IN" as const,     // VERIFY: BSE PDF
};
