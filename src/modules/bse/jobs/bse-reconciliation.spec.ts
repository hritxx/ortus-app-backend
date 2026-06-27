import { BseReconciliationProcessor } from "./bse-reconciliation.processor";

function make(orders: any[]) {
  const prisma = {
    mutualFundOrder: {
      findMany: jest.fn().mockResolvedValue(orders),
      update: jest.fn().mockResolvedValue({}),
    },
  } as any;
  const bse = { syncOrderStatus: jest.fn().mockResolvedValue({}) } as any;
  return { proc: new BseReconciliationProcessor(prisma, bse), prisma, bse };
}

describe("reconcileOpenOrders", () => {
  it("syncs every non-terminal order", async () => {
    const { proc, bse } = make([
      { id: "a", status: "PAID", createdAt: new Date() },
      { id: "b", status: "PROCESSING", createdAt: new Date() },
    ]);
    const res = await proc.reconcileOpenOrders(new Date());
    expect(bse.syncOrderStatus).toHaveBeenCalledTimes(2);
    expect(bse.syncOrderStatus).toHaveBeenCalledWith("a");
    expect(bse.syncOrderStatus).toHaveBeenCalledWith("b");
    expect(res.checked).toBe(2);
  });

  it("auto-cancels a PENDING_PAYMENT order past the T+1 09:30 cutoff", async () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 3600 * 1000);
    const { proc, prisma, bse } = make([{ id: "stale", status: "PENDING_PAYMENT", createdAt: twoDaysAgo }]);
    const res = await proc.reconcileOpenOrders(new Date());
    expect(prisma.mutualFundOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "stale" },
        data: expect.objectContaining({ status: "CANCELLED" }),
      }),
    );
    // The stale order is cancelled via `continue` — it must NOT also be synced.
    expect(bse.syncOrderStatus).not.toHaveBeenCalled();
    expect(res.checked).toBe(1);
    expect(res.autoCancelled).toBe(1);
  });
});
