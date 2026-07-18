/**
 * Maps our internal User to a BSE StAR MF v2 /v2/add_ucc payload for a
 * Resident Individual, Single holding (SI), physical (non-demat) account.
 *
 * CONFIRM IN UAT: every enum/code below. These follow the Postman
 * "add_ucc() Individual SI Physical" example but must be validated against a
 * live demo response before go-live. Keep all BSE-specific values in this file.
 */

export const UCC_CODES = {
  holdingNature: "SI", // Single
  taxCode: "01", // Resident individual
  rdmpIdcwPayMode: "01", // redemption/IDCW payout mode
  commMode: "E", // email
  onboarding: "Z", // onboarding channel
  occCode: "02", // occupation: private sector (CONFIRM per user)
  authMode: "M", // holder auth mode
  nominationAuthMode: "O",
  accountType: "SB", // savings
} as const;

export interface UccUserInput {
  name?: string | null;
  panNumber?: string | null;
  email: string;
  phone?: string | null;
  bankAccount?: string | null;
  ifscCode?: string | null;
  bankName?: string | null;
}

export function buildAddUccPayload(user: UccUserInput, clientCode: string, memberCode: string) {
  return {
    data: {
      investor: { client_code: clientCode },
      is_multi_ucc: false,
      parent_client_code: "",
      member: memberCode,
      holding_nature: UCC_CODES.holdingNature,
      tax_code: UCC_CODES.taxCode,
      rdmp_idcw_pay_mode: UCC_CODES.rdmpIdcwPayMode,
      is_client_physical: true,
      is_client_demat: false,
      is_nomination_opted: false,
      nominee_soa: false,
      nomination_auth_mode: UCC_CODES.nominationAuthMode,
      comm_mode: UCC_CODES.commMode,
      onboarding: UCC_CODES.onboarding,
      holder: [
        {
          holder_rank: "1",
          name: user.name ?? "Investor",
          occ_code: UCC_CODES.occCode,
          auth_mode: UCC_CODES.authMode,
          is_pan_exempt: false,
          pan_exempt_category: "",
          email: user.email,
          mobnum: user.phone ?? "",
          identifier: [
            {
              identifier_type: "pan",
              identifier_number: user.panNumber ?? "",
            },
          ],
        },
      ],
      bank_acct: {
        ifsc: user.ifscCode ?? "",
        no: user.bankAccount ?? "",
        type: UCC_CODES.accountType,
        name: user.bankName ?? "",
        default_bank_flag: true,
      },
    },
  };
}
