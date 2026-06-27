import { mapBseError, BseError } from "./bse-error.map";

describe("mapBseError", () => {
  it("throws a BseError carrying the raw code", () => {
    expect.assertions(2);
    try { mapBseError("100", "Invalid Password"); }
    catch (e) { expect(e).toBeInstanceOf(BseError); expect((e as BseError).bseCode).toBe("100"); }
  });

  it("maps a known auth failure to a friendly user message", () => {
    try { mapBseError("100"); }
    catch (e) { expect((e as BseError).userMessage).toMatch(/try again/i); }
  });

  it("falls back to a generic message for unknown codes", () => {
    try { mapBseError("99999", "weird"); }
    catch (e) { expect((e as BseError).userMessage).toMatch(/something went wrong/i); }
  });
});
