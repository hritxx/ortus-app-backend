import { BseSchemeService } from "./bse-scheme.service";

describe("BseSchemeService.listFunds", () => {
  it("filters by search and category", async () => {
    const prisma = { mfScheme: { findMany: jest.fn().mockResolvedValue([]) } };
    const svc = new BseSchemeService(prisma as any, {} as any);
    await svc.listFunds("blue", "Equity");
    expect(prisma.mfScheme.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          category: "Equity",
          schemeName: { contains: "blue", mode: "insensitive" },
        }),
      }),
    );
  });
});
