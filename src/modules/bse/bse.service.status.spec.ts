import { ForbiddenException } from "@nestjs/common";
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
  const notify = { pushToUser: jest.fn().mockResolvedValue(true) } as any;
  const svc = new BseService(prisma, {} as any, soap, session, notify);
  return { svc, prisma, soap, session };
}

describe("BseService.syncOrderStatus", () => {
  it("writes folio + units + ALLOTTED when BSE reports allotment", async () => {
    const { svc, prisma } = make(
      { id: "o1", userId: "u1", bseOrderNumber: "B1", status: "PAID" },
      { allotted: true, folio: "F123", units: 12.34 },
    );
    const updated = await svc.syncOrderStatus("o1");
    expect(prisma.mutualFundOrder.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "ALLOTTED", folioNumber: "F123", units: 12.34 }),
    }));
    expect(updated.status).toBe("ALLOTTED");
  });

  it("rejects with ForbiddenException when caller does not own the order", async () => {
    const { svc, prisma, soap, session } = make(
      { id: "o1", userId: "u1", bseOrderNumber: "B1", status: "PAID" },
      { allotted: true, folio: "F123", units: 12.34 },
    );
    await expect(svc.syncOrderStatus("o1", "other-user")).rejects.toBeInstanceOf(ForbiddenException);
    // ownership is enforced before any BSE/session side effects
    expect(session.getToken).not.toHaveBeenCalled();
    expect(soap.getOrderStatus).not.toHaveBeenCalled();
    expect(prisma.mutualFundOrder.update).not.toHaveBeenCalled();
  });

  it("allows a trusted system caller (no userId) to sync any order", async () => {
    const { svc } = make(
      { id: "o1", userId: "u1", bseOrderNumber: "B1", status: "PAID" },
      { allotted: true, folio: "F123", units: 12.34 },
    );
    const updated = await svc.syncOrderStatus("o1");
    expect(updated.status).toBe("ALLOTTED");
  });
});
