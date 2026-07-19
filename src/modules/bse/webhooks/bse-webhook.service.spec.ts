import { BseWebhookService } from "./bse-webhook.service";

function make() {
  const prisma = {
    user: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    mutualFundOrder: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  const orders = { syncOrderStatus: jest.fn().mockResolvedValue({}) };
  return { svc: new BseWebhookService(prisma as any, orders as any), prisma, orders };
}

describe("BseWebhookService", () => {
  it("marks the UCC ACTIVE on a UCC ACTIVE event", async () => {
    const { svc, prisma } = make();
    await svc.handle({
      investor: { client_code: "ORTUS0001" },
      action: { event_type: "UCC", event: "ACTIVE" },
    });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { bseUcc: "ORTUS0001" },
      data: { bseUccStatus: "ACTIVE" },
    });
  });

  it("resyncs the matching order on an ORDER event", async () => {
    const { svc, prisma, orders } = make();
    prisma.mutualFundOrder.findFirst.mockResolvedValue({ id: "o1" });
    await svc.handle({
      investor: { client_code: "ORTUS0001" },
      action: { event_type: "ORDER", event: "units_rta_settled", order_id: "5000001", mem_ord_ref_id: "12345" },
    });
    expect(orders.syncOrderStatus).toHaveBeenCalledWith("o1");
  });

  it("always ACKs, even on handler error", async () => {
    const { svc, prisma } = make();
    prisma.user.updateMany.mockRejectedValue(new Error("db down"));
    const res = await svc.handle({ investor: { client_code: "X" }, action: { event_type: "UCC", event: "ACTIVE" } });
    expect(res).toEqual({ status: "ok" });
  });
});
