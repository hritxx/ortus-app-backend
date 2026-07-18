import { buildAddUccPayload } from "./ucc.mapper";

describe("buildAddUccPayload", () => {
  const user = {
    name: "Asha Rao",
    panNumber: "ABCDE1234F",
    email: "asha@example.com",
    phone: "9999999999",
    bankAccount: "123456789012",
    ifscCode: "HDFC0000001",
    bankName: "HDFC Bank",
  };

  it("maps a resident individual SI physical UCC", () => {
    const p = buildAddUccPayload(user, "ORTUS0001", "66881").data;
    expect(p.investor.client_code).toBe("ORTUS0001");
    expect(p.member).toBe("66881");
    expect(p.holding_nature).toBe("SI");
    expect(p.tax_code).toBe("01");
    expect(p.is_client_physical).toBe(true);
    expect(p.is_client_demat).toBe(false);
    expect(p.comm_mode).toBe("E");
  });

  it("puts the PAN in the holder identifier block", () => {
    const p = buildAddUccPayload(user, "ORTUS0001", "66881").data;
    expect(p.holder[0].identifier[0]).toEqual({
      identifier_type: "pan",
      identifier_number: "ABCDE1234F",
    });
    expect(p.holder[0].email).toBe("asha@example.com");
  });

  it("maps the bank account block", () => {
    const p = buildAddUccPayload(user, "ORTUS0001", "66881").data;
    expect(p.bank_acct).toMatchObject({
      ifsc: "HDFC0000001",
      no: "123456789012",
      type: "SB",
      name: "HDFC Bank",
    });
  });
});
