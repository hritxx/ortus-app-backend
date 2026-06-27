import { BseController } from "./bse.controller";

function make() {
  const svc = {
    onboard: jest.fn().mockResolvedValue({ ucc: "U1", fatcaRegistered: true }),
    purchase: jest.fn().mockResolvedValue({ orderId: "o1", orderNumber: "B1", paymentUrl: "http://pay" }),
    syncOrderStatus: jest.fn().mockResolvedValue({ id: "o1", status: "ALLOTTED" }),
    listFunds: jest.fn().mockResolvedValue([{ schemeCode: "S1" }]),
  } as any;
  return { ctrl: new BseController(svc), svc };
}
const req = { user: { id: "u1" } } as any;

describe("BseController", () => {
  it("passes the authenticated user id to onboard", async () => {
    const { ctrl, svc } = make();
    await ctrl.onboard(req);
    expect(svc.onboard).toHaveBeenCalledWith("u1");
  });
  it("forwards purchase body + user id", async () => {
    const { ctrl, svc } = make();
    const dto = { schemeCode: "S1", schemeName: "F", amount: 500, type: "LUMPSUM" } as any;
    const res = await ctrl.purchase(req, dto);
    expect(svc.purchase).toHaveBeenCalledWith("u1", dto);
    expect(res.paymentUrl).toBe("http://pay");
  });
});
