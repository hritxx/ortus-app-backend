import { BseService } from "./bse.service";

function make(order: any, bseStatus: any) {
  const prisma = {
    mutualFundOrder: {
      findUnique: jest.fn().mockResolvedValue(order),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...order, ...data })),
    },
  } as any;
  const soap = { getOrderStatus: jest.fn().mockResolvedValue(bseStatus) } as any;
  const session = { getToken: jest.fn().mockResolvedValue("TOK") } as any;
  const svc = new BseService(prisma, {} as any, soap, session);
  return { svc, prisma };
}

describe("BseService.syncOrderStatus", () => {
  it("writes folio + units + ALLOTTED when BSE reports allotment", async () => {
    const { svc, prisma } = make(
      { id: "o1", bseOrderNumber: "B1", status: "PAID" },
      { allotted: true, folio: "F123", units: 12.34 },
    );
    const updated = await svc.syncOrderStatus("o1");
    expect(prisma.mutualFundOrder.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "ALLOTTED", folioNumber: "F123", units: 12.34 }),
    }));
    expect(updated.status).toBe("ALLOTTED");
  });
});
