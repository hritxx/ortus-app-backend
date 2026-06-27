// VERIFY EVERY VALUE against the BSE API File Structure PDF. This file is the only
// place BSE-specific names live, so spec revisions are a one-file change.
export const SOAP = {
  getPasswordMethod: "getPassword",       // VERIFY
  orderEntryMethod: "orderEntryParam",    // VERIFY
  responseDelimiter: "|",                 // BSE often returns pipe-delimited "code|message|payload" // VERIFY
};
export const REST = {
  uccRegistration: "/ClientMaster/Registration", // VERIFY (StarMFCommonAPI)
  fatcaRegistration: "/FatcaRegistration",        // VERIFY
};
