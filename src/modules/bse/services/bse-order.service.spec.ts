import { BadRequestException } from "@nestjs/common";
import { BseOrderService } from "./bse-order.service";

function setup(opts: { user?: any; holding?: any; existingOrder?: any } = {}) {
  const user = opts.user ?? { id: "u1", bseUcc: "ORTUS0001", email: "a@b.com", phone: "999" };
  const created: any[] = [];
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(user) },
    mutualFundOrder: {
      findUnique: jest.fn().mockResolvedValue(opts.existingOrder ?? null),
      create: jest.fn().mockImplementation(({ data }) => {
        const row = { id: "order_" + created.length, ...data };
        created.push(row);
        return Promise.resolve(row);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => Promise.resolve({ id: where.id, ...data })),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  const sdk = {
    orderNew: jest.fn().mockResolvedValue({ data: { orders: [{ id: 5000010001 }] } }),
    orderGet: jest.fn(),
  };
  const cfg = { memberCode: "66881" };
  const holdings = {
    getHolding: jest.fn().mockResolvedValue(opts.holding ?? null),
    upsertFromAllotment: jest.fn(),
    decrementOnRedeem: jest.fn(),
  };
  const payment = {
    getPaymentUrl: jest.fn().mockResolvedValue({ paymentUrl: "https://pay/redir", paymentRefId: "PR1" }),
  };
  const notify = { pushToUser: jest.fn().mockResolvedValue(true) };
  const svc = new BseOrderService(
    prisma as any,
    sdk as any,
    cfg as any,
    holdings as any,
    payment as any,
    notify as any,
  );
  return { svc, prisma, sdk, holdings, payment, notify };
}

describe("BseOrderService.purchase", () => {
  it("pre-inserts the order before calling BSE and returns a payment URL", async () => {
    const { svc, prisma, sdk } = setup();
    const res = await svc.purchase("u1", { schemeCode: "ABC-GR", schemeName: "ABC", amount: 5000 });
    // order created before orderNew called
    const createOrder = prisma.mutualFundOrder.create.mock.invocationCallOrder[0];
    const bseCallOrder = sdk.orderNew.mock.invocationCallOrder[0];
    expect(createOrder).toBeLessThan(bseCallOrder);
    expect(res.orderNumber).toBe("5000010001");
    expect(res.paymentUrl).toBe("https://pay/redir");
  });

  it("rejects purchase when user has no UCC", async () => {
    const { svc } = setup({ user: { id: "u1", bseUcc: null } });
    await expect(
      svc.purchase("u1", { schemeCode: "ABC-GR", schemeName: "ABC", amount: 5000 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("is idempotent for a repeated idempotencyKey", async () => {
    const { svc, sdk } = setup({
      existingOrder: { id: "order_x", bseOrderNumber: "999", paymentUrl: "u" },
    });
    const res = await svc.purchase("u1", {
      schemeCode: "ABC-GR",
      schemeName: "ABC",
      amount: 5000,
      idempotencyKey: "KEY-1",
    });
    expect(sdk.orderNew).not.toHaveBeenCalled();
    expect(res.orderId).toBe("order_x");
  });
});

describe("BseOrderService.redeem", () => {
  it("rejects when the user holds no units", async () => {
    const { svc } = setup({ holding: null });
    await expect(
      svc.redeem("u1", { schemeCode: "ABC-GR", folioNumber: "F1", units: 5 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects overselling", async () => {
    const { svc } = setup({ holding: { units: 10, schemeName: "ABC" } });
    await expect(
      svc.redeem("u1", { schemeCode: "ABC-GR", folioNumber: "F1", units: 50 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("places a sell order within holdings", async () => {
    const { svc, sdk } = setup({ holding: { units: 100, schemeName: "ABC" } });
    const res = await svc.redeem("u1", { schemeCode: "ABC-GR", folioNumber: "F1", units: 30 });
    expect(sdk.orderNew).toHaveBeenCalledTimes(1);
    expect(res.orderNumber).toBe("5000010001");
  });
});

describe("BseOrderService.syncOrderStatus", () => {
  it("upserts a holding and notifies on allotment", async () => {
    const { svc, prisma, sdk, holdings, notify } = setup();
    prisma.mutualFundOrder.findUnique.mockResolvedValueOnce({
      id: "o1",
      userId: "u1",
      side: "BUY",
      status: "PAID",
      bseOrderNumber: "5000010001",
      schemeCode: "ABC-GR",
      schemeName: "ABC",
      folioNumber: null,
      units: null,
    });
    sdk.orderGet.mockResolvedValue({
      data: { orders: [{ order_status: "ALLOTTED", allotted: true, folio: "F1", units: 120.5 }] },
    });
    await svc.syncOrderStatus("o1", "u1");
    expect(holdings.upsertFromAllotment).toHaveBeenCalledWith(
      expect.objectContaining({ folioNumber: "F1", units: 120.5 }),
    );
    expect(notify.pushToUser).toHaveBeenCalled();
  });
});
