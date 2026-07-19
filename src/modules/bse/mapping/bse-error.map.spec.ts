import { normalizeBseResponse, BseError } from "./bse-error.map";

describe("normalizeBseResponse", () => {
  it("passes through the real UAT success envelope", () => {
    const ok = { status: "success", data: { access_token: "t" }, messages: [] };
    expect(normalizeBseResponse(ok)).toBe(ok);
  });

  it("throws on the real UAT error envelope and surfaces field messages", () => {
    const err = {
      status: "error",
      data: null,
      messages: [{ msgid: 559, errcode: "invalid_data", field: "fatca.country_of_birth", vals: ["IN"] }],
    };
    let thrown: BseError | undefined;
    try {
      normalizeBseResponse(err);
    } catch (e) {
      thrown = e as BseError;
    }
    expect(thrown).toBeInstanceOf(BseError);
    expect(thrown!.bseCode).toBe("invalid_data");
    // Field-level detail is preserved in the raw message for ops/debugging.
    expect((thrown!.getResponse() as any).raw).toContain("fatca.country_of_birth");
  });

  it("throws on HTTP-style error bodies", () => {
    expect(() => normalizeBseResponse({ status: 401, errorMsg: "bad creds" })).toThrow(BseError);
  });

  it("throws on an empty response", () => {
    expect(() => normalizeBseResponse(null)).toThrow(BseError);
  });
});
