import { BseHoldingService } from "./bse-holding.service";

function makePrisma(existing: any = null) {
  return {
    mfHolding: {
      findUnique: jest.fn().mockResolvedValue(existing),
      findFirst: jest.fn().mockResolvedValue(existing),
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
  };
}

const key = { userId: "u1", ucc: "ORTUS0001", schemeCode: "ABC-GR", schemeName: "ABC", folioNumber: "F1" };

describe("BseHoldingService", () => {
  it("creates a holding on first allotment", async () => {
    const prisma = makePrisma(null);
    const svc = new BseHoldingService(prisma as any);
    await svc.upsertFromAllotment({ ...key, units: 100 });
    expect(prisma.mfHolding.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ units: 100 }) }),
    );
  });

  it("adds units on a second allotment to the same folio", async () => {
    const prisma = makePrisma({ units: 40 });
    const svc = new BseHoldingService(prisma as any);
    await svc.upsertFromAllotment({ ...key, units: 60 });
    expect(prisma.mfHolding.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ units: 100 }) }),
    );
  });

  it("subtracts units on partial redeem", async () => {
    const prisma = makePrisma({ id: "h1", units: 100 });
    const svc = new BseHoldingService(prisma as any);
    await svc.decrementOnRedeem({ ucc: "ORTUS0001", schemeCode: "ABC-GR", folioNumber: "F1", units: 30 });
    expect(prisma.mfHolding.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { units: 70 } }),
    );
  });

  it("deletes the holding on full redeem", async () => {
    const prisma = makePrisma({ id: "h1", units: 100 });
    const svc = new BseHoldingService(prisma as any);
    await svc.decrementOnRedeem({ ucc: "ORTUS0001", schemeCode: "ABC-GR", folioNumber: "F1", allUnits: true });
    expect(prisma.mfHolding.delete).toHaveBeenCalledWith({ where: { id: "h1" } });
  });

  it("getHolding returns null when absent", async () => {
    const prisma = makePrisma(null);
    const svc = new BseHoldingService(prisma as any);
    await expect(svc.getHolding("u1", "ABC-GR", "F1")).resolves.toBeNull();
  });
});
