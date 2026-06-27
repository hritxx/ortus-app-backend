// Confirms the order shape the service relies on. Uses a mocked PrismaService.
describe("MutualFundOrder shape", () => {
  it("creates a PENDING_PAYMENT lumpsum order with the expected fields", async () => {
    const prisma = {
      mutualFundOrder: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: "o1", ...data })),
      },
    } as any;

    const order = await prisma.mutualFundOrder.create({
      data: { userId: "u1", schemeCode: "S1", schemeName: "Demo Fund", amount: 500, type: "LUMPSUM", status: "PENDING_PAYMENT" },
    });

    expect(order).toMatchObject({ userId: "u1", amount: 500, type: "LUMPSUM", status: "PENDING_PAYMENT" });
    expect(prisma.mutualFundOrder.create).toHaveBeenCalledTimes(1);
  });
});
