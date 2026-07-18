import { BseController } from "./bse.controller";

function make() {
  const onboarding = { onboard: jest.fn().mockResolvedValue({ ucc: "U1", fatcaRegistered: true }) };
  const orders = {
    purchase: jest.fn().mockResolvedValue({ orderId: "o1", orderNumber: "B1", paymentUrl: "http://pay" }),
    redeem: jest.fn().mockResolvedValue({ orderId: "o2", orderNumber: "B2" }),
    syncOrderStatus: jest.fn().mockResolvedValue({ id: "o1", status: "ALLOTTED" }),
    listOrders: jest.fn().mockResolvedValue([{ id: "o1" }]),
  };
  const payment = { confirmPayment: jest.fn().mockResolvedValue({ ok: true }) };
  const holdings = { listHoldings: jest.fn().mockResolvedValue([{ schemeCode: "S1" }]) };
  const schemes = { listFunds: jest.fn().mockResolvedValue([{ schemeCode: "S1" }]) };
  const ctrl = new BseController(
    onboarding as any,
    orders as any,
    payment as any,
    holdings as any,
    schemes as any,
  );
  return { ctrl, onboarding, orders, payment, holdings, schemes };
}
const req = { user: { id: "u1" } } as any;

describe("BseController", () => {
  it("passes the authenticated user id to onboard", async () => {
    const { ctrl, onboarding } = make();
    await ctrl.onboard(req);
    expect(onboarding.onboard).toHaveBeenCalledWith("u1");
  });

  it("forwards purchase body + user id", async () => {
    const { ctrl, orders } = make();
    const dto = { schemeCode: "S1", schemeName: "F", amount: 500, type: "LUMPSUM" } as any;
    const res = await ctrl.purchase(req, dto);
    expect(orders.purchase).toHaveBeenCalledWith("u1", dto);
    expect(res.paymentUrl).toBe("http://pay");
  });

  it("forwards redeem body + user id", async () => {
    const { ctrl, orders } = make();
    const dto = { schemeCode: "S1", folioNumber: "F1", units: 10 } as any;
    await ctrl.redeem(req, dto);
    expect(orders.redeem).toHaveBeenCalledWith("u1", dto);
  });

  it("forwards the order id AND the authenticated user id to syncOrderStatus", async () => {
    const { ctrl, orders } = make();
    await ctrl.status("someId", req);
    expect(orders.syncOrderStatus).toHaveBeenCalledWith("someId", "u1");
  });

  it("lists holdings for the authenticated user", async () => {
    const { ctrl, holdings } = make();
    await ctrl.holdingsList(req);
    expect(holdings.listHoldings).toHaveBeenCalledWith("u1");
  });
});
