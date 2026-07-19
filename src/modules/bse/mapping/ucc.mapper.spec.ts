import { buildAddUccPayload } from "./ucc.mapper";

describe("buildAddUccPayload (v2, UAT-verified schema)", () => {
  const user = {
    name: "Asha Kumari Rao",
    panNumber: "ABCPE1234F",
    email: "asha@example.com",
    phone: "9999999999",
    dateOfBirth: "1985-06-15",
    address: "Flat 12, Main St",
    city: "Mumbai",
    state: "MH",
    pincode: "400001",
    bankAccount: "123456789012",
    ifscCode: "HDFC0000001",
  };

  it("uses member_code.member_id and investor.client_code", () => {
    const p = buildAddUccPayload(user, "ORTUS0001", "66881").data;
    expect(p.member_code).toEqual({ member_id: "66881" });
    expect(p.investor.client_code).toBe("ORTUS0001");
    expect(p.holding_nature).toBe("SI");
    expect(p.nomination_auth_mode).toBe("O"); // required even when opting out
  });

  it("maps the holder person, PAN identifier, and contact", () => {
    const p = buildAddUccPayload(user, "ORTUS0001", "66881").data;
    expect(p.holder[0].identifier[0]).toEqual({ identifier_type: "pan", identifier_number: "ABCPE1234F" });
    expect(p.holder[0].person).toMatchObject({ first_name: "Asha", middle_name: "Kumari", last_name: "Rao", dob: "1985-06-15" });
    expect(p.holder[0].contact[0]).toMatchObject({ email_address: "asha@example.com", contact_number: "9999999999" });
  });

  it("maps the bank_account block with v2 keys", () => {
    const p = buildAddUccPayload(user, "ORTUS0001", "66881").data;
    expect(p.bank_account[0]).toMatchObject({
      ifsc_code: "HDFC0000001",
      bank_acc_num: "123456789012",
      bank_acc_type: "SB",
      account_owner: "SELF",
    });
  });

  it("embeds FATCA with ISO alpha-3 country codes", () => {
    const p = buildAddUccPayload(user, "ORTUS0001", "66881").data;
    expect(p.fatca[0].country_of_birth).toBe("IND");
    expect(p.fatca[0].tax_residency[0].Country).toBe("IND");
    expect(p.fatca[0].Identifier).toEqual({ identifier_type: "pan", identifier_number: "ABCPE1234F" });
  });
});
