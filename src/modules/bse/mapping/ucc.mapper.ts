/**
 * Maps our internal User to a BSE StAR MF v2 /v2/add_ucc payload for a
 * Resident Individual, Single holding (SI), physical (non-demat) account.
 *
 * This schema is VERIFIED against the live UAT demo (a UCC was created successfully
 * on 2026-07-19). Key rules learned from UAT and encoded here:
 *  - `member_code: { member_id }` (NOT a flat `member`).
 *  - FATCA is EMBEDDED in add_ucc (not a separate call).
 *  - Country fields use ISO alpha-3 codes ("IND"), not names or numeric codes.
 *  - `nomination_auth_mode` is required for physical + Single even when opting out.
 *  - PAN's 4th character must be "P" for an individual (BSE validates this).
 *  - bank block is `bank_account: [{ ifsc_code, bank_acc_num, bank_acc_type, account_owner }]`.
 *
 * Fields our User model does not yet capture (gender, father's name, place of birth,
 * income slab) are defaulted below and marked COLLECT — they must be gathered during
 * real KYC before production. Nomination is opted out for now (full nominee sub-profile
 * — contact/address/pan-exempt category — is a follow-up).
 */

export const UCC_CODES = {
  holdingNature: "SI",
  taxCode: "01", // resident individual
  rdmpIdcwPayMode: "01",
  commMode: "E", // email
  onboarding: "Z",
  occCode: "02", // holder occupation (private sector) — COLLECT per user
  authMode: "M",
  nominationAuthMode: "O",
  bankAccType: "SB", // savings
  accountOwner: "SELF",
  countryIso3: "IND", // BSE wants ISO alpha-3
  // FATCA defaults — COLLECT real values during KYC before production.
  fatcaOccCode: "01",
  fatcaOccType: "B",
  fatcaExemptionCode: "A",
  fatcaAddressType: "1",
  fatcaCorpServiceSector: "1",
  fatcaWealthSource: "1",
  fatcaIncomeSlab: "31",
  fatcaTaxIdType: "A",
  gender: "M", // COLLECT — User has no gender field yet
} as const;

export interface UccUserInput {
  name?: string | null;
  panNumber?: string | null;
  email: string;
  phone?: string | null;
  dateOfBirth?: string | null; // expected YYYY-MM-DD (CONFIRM format vs stored value)
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  bankAccount?: string | null;
  ifscCode?: string | null;
}

function splitName(full?: string | null): { first: string; middle: string; last: string } {
  const parts = (full ?? "Investor").trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], middle: "", last: parts[0] };
  if (parts.length === 2) return { first: parts[0], middle: "", last: parts[1] };
  return { first: parts[0], middle: parts.slice(1, -1).join(" "), last: parts[parts.length - 1] };
}

export function buildAddUccPayload(user: UccUserInput, clientCode: string, memberCode: string) {
  const nm = splitName(user.name);
  const pan = user.panNumber ?? "";
  const clientName = [nm.first, nm.middle, nm.last].filter(Boolean).join(" ");

  return {
    data: {
      member_code: { member_id: memberCode },
      investor: { client_code: clientCode },
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
          occ_code: UCC_CODES.occCode,
          auth_mode: UCC_CODES.authMode,
          is_pan_exempt: false,
          identifier: [{ identifier_type: "pan", identifier_number: pan }],
          person: {
            first_name: nm.first,
            middle_name: nm.middle,
            last_name: nm.last,
            dob: user.dateOfBirth ?? "",
            gender: UCC_CODES.gender,
          },
          contact: [
            {
              contact_number: user.phone ?? "",
              country_code: "91",
              whose_contact_number: "SE",
              email_address: user.email,
              whose_email_address: "SE",
              contact_type: "PR",
            },
          ],
        },
      ],
      comm_addr: {
        address_line_1: user.address ?? "",
        address_line_2: user.city ?? "",
        address_line_3: [user.state, user.pincode].filter(Boolean).join(" "),
        comm_mode: UCC_CODES.commMode,
        postalcode: user.pincode ?? "",
      },
      bank_account: [
        {
          ifsc_code: user.ifscCode ?? "",
          bank_acc_num: user.bankAccount ?? "",
          bank_acc_type: UCC_CODES.bankAccType,
          account_owner: UCC_CODES.accountOwner,
        },
      ],
      fatca: [
        {
          holder_rank: "1",
          place_of_birth: user.city ?? "NA", // COLLECT
          country_of_birth: UCC_CODES.countryIso3,
          client_name: clientName,
          investor_type: "Individual",
          dob: user.dateOfBirth ?? "",
          father_name: "NA", // COLLECT
          address_type: UCC_CODES.fatcaAddressType,
          occ_code: UCC_CODES.fatcaOccCode,
          occ_type: UCC_CODES.fatcaOccType,
          tax_status: "Individual",
          exemption_code: UCC_CODES.fatcaExemptionCode,
          Identifier: { identifier_type: "pan", identifier_number: pan },
          corporate_service_sector: UCC_CODES.fatcaCorpServiceSector,
          wealth_source: UCC_CODES.fatcaWealthSource,
          income_slab: UCC_CODES.fatcaIncomeSlab,
          net_worth: 100000.0,
          date_of_net_worth: "2024-06-01",
          politically_exposed: "N",
          is_self_declared: true,
          data_source: "P",
          tax_residency: [
            { Country: UCC_CODES.countryIso3, tax_id_no: pan, tax_id_type: UCC_CODES.fatcaTaxIdType },
          ],
        },
      ],
    },
  };
}
