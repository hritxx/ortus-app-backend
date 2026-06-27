import { BseService } from "./bse.service";

function make(user = { id: "u1", bseUcc: "UCC1", fatcaRegistered: true }) {
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(user) },
    mutualFundOrder: { create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "o1", ...data })),
                       update: jest.fn().mockResolvedValue({}) },
  } as any;
  const soap = { placeOrder: jest.fn().mockResolvedValue({ orderNumber: "BSE999" }) } as any;
  const session = { getToken: jest.fn().mockResolvedValue("TOK") } as any;
  const rest = {} as any;
  const svc = new BseService(prisma, rest, soap, session, {} as any);
  return { svc, prisma, soap, session };
}

describe("BseService.purchase", () => {
  it("places an order and persists it as PENDING_PAYMENT", async () => {
    const { svc, prisma, soap, session } = make();
    const res = await svc.purchase("u1", { schemeCode: "S1", schemeName: "Fund", amount: 500, type: "LUMPSUM" });
    expect(session.getToken).toHaveBeenCalledWith("order");
    expect(soap.placeOrder).toHaveBeenCalledWith(expect.objectContaining({ ucc: "UCC1", schemeCode: "S1", amount: 500, buySell: "P", orderType: "LUMPSUM" }));
    expect(prisma.mutualFundOrder.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "PENDING_PAYMENT", bseOrderNumber: "BSE999" }) }));
    expect(res).toMatchObject({ orderNumber: "BSE999" });
    expect(res.orderId).toBe("o1");
    expect(res.paymentUrl).toContain("BSE999");
  });

  it("refuses to purchase before onboarding (no UCC)", async () => {
    const { svc } = make({ id: "u1", bseUcc: null, fatcaRegistered: false } as any);
    await expect(svc.purchase("u1", { schemeCode: "S1", schemeName: "F", amount: 500, type: "LUMPSUM" }))
      .rejects.toThrow(/onboard/i);
  });
});
