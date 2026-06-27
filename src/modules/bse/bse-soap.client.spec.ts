import { parsePipeResponse } from "./bse-soap.client";

describe("parsePipeResponse", () => {
  it("splits a success response into code + message", () => {
    // BSE convention (VERIFY): "100|Success|ORDER12345"
    expect(parsePipeResponse("100|Success|ORDER12345")).toEqual({ code: "100", message: "Success", payload: "ORDER12345" });
  });
  it("handles responses with no payload", () => {
    expect(parsePipeResponse("0|FAILED")).toEqual({ code: "0", message: "FAILED", payload: undefined });
  });
});
