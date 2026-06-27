import { mapOrderStatus } from "./bse-status.map";

describe("mapOrderStatus", () => {
  it("maps a fresh order awaiting payment to PENDING_PAYMENT", () => {
    expect(mapOrderStatus({ paymentStatus: "NOT_PAID" })).toBe("PENDING_PAYMENT");
  });
  it("maps a matched payment to PAID", () => {
    expect(mapOrderStatus({ paymentStatus: "PAID", orderStatus: "VALID" })).toBe("PAID");
  });
  it("maps an allotted order to ALLOTTED", () => {
    expect(mapOrderStatus({ allotted: true })).toBe("ALLOTTED");
  });
  it("maps a rejected order to REJECTED", () => {
    expect(mapOrderStatus({ orderStatus: "REJECTED" })).toBe("REJECTED");
  });
});
