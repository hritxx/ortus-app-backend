import { BseService } from "./bse.service";

function make(order: any, bseStatus: any) {
  const prisma = {
    mutualFundOrder: {
      findUnique: jest.fn().mockResolvedValue(order),
      update: jest
        .fn()
        .mockImplementation(({ data }) => Promise.resolve({ ...order, ...data })),
    },
  } as any;
  const soap = { getOrderStatus: jest.fn().mockResolvedValue(bseStatus) } as any;
  const session = { getToken: jest.fn().mockResolvedValue("T") } as any;
  const notify = { pushToUser: jest.fn().mockResolvedValue(true) } as any;
  const svc = new BseService(prisma, {} as any, soap, session, notify);
  return { svc, notify };
}

describe("BseService notifications", () => {
  it("pushes an allotment notification when the order becomes ALLOTTED", async () => {
    const { svc, notify } = make(
      { id: "o1", userId: "u1", bseOrderNumber: "B1", status: "PAID", schemeName: "Demo Fund" },
      { allotted: true, folio: "F", units: 1 },
    );
    await svc.syncOrderStatus("o1");
    expect(notify.pushToUser).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ title: expect.stringMatching(/allotted/i), data: { orderId: "o1" } }),
    );
  });

  it("pushes a rejection notification when the order becomes REJECTED", async () => {
    const { svc, notify } = make(
      { id: "o2", userId: "u2", bseOrderNumber: "B2", status: "PAID", schemeName: "Demo Fund" },
      { orderStatus: "REJECTED" },
    );
    await svc.syncOrderStatus("o2");
    expect(notify.pushToUser).toHaveBeenCalledWith(
      "u2",
      expect.objectContaining({ title: expect.stringMatching(/reject/i) }),
    );
  });

  it("does NOT push when the status did not transition", async () => {
    const { svc, notify } = make(
      { id: "o3", userId: "u3", bseOrderNumber: "B3", status: "PROCESSING", schemeName: "Demo Fund" },
      { orderStatus: "PROCESSING" },
    );
    await svc.syncOrderStatus("o3");
    expect(notify.pushToUser).not.toHaveBeenCalled();
  });

  it("still returns the updated order even if the push fails", async () => {
    const { svc, notify } = make(
      { id: "o4", userId: "u4", bseOrderNumber: "B4", status: "PAID", schemeName: "Demo Fund" },
      { allotted: true, folio: "F4", units: 2 },
    );
    notify.pushToUser.mockRejectedValueOnce(new Error("FCM down"));
    const updated = await svc.syncOrderStatus("o4");
    expect(updated.status).toBe("ALLOTTED");
  });
});
