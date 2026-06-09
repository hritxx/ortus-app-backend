import { UnauthorizedException } from "@nestjs/common";
import * as crypto from "crypto";
import { PaymentService } from "./payment.service";

const CF_SECRET = "cf_secret";
const RZP_SECRET = "rzp_secret";

function makeService() {
  const prisma = {
    transaction: {
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
  } as any;
  const config = {
    get: (k: string) =>
      k === "CASHFREE_SECRET_KEY" ? CF_SECRET : k === "RAZORPAY_WEBHOOK_SECRET" ? RZP_SECRET : undefined,
  } as any;
  const svc = new PaymentService(prisma, config, {} as any, {} as any);
  return { svc, prisma };
}

describe("PaymentService webhook signature verification", () => {
  it("rejects a Cashfree webhook with a missing signature", async () => {
    const { svc } = makeService();
    await expect(svc.handleCashfreeWebhook("{}", {}, "", "")).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects a Cashfree webhook with a forged signature", async () => {
    const { svc } = makeService();
    await expect(
      svc.handleCashfreeWebhook('{"x":1}', { x: 1 }, "forged", "12345"),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("accepts a Cashfree webhook with a valid signature", async () => {
    const { svc, prisma } = makeService();
    const rawBody = JSON.stringify({
      data: {
        order: { order_id: "o1" },
        payment: { cf_payment_id: "p1", payment_status: "SUCCESS" },
      },
    });
    const ts = "12345";
    const sig = crypto.createHmac("sha256", CF_SECRET).update(ts + rawBody).digest("base64");
    const res = await svc.handleCashfreeWebhook(rawBody, JSON.parse(rawBody), sig, ts);
    expect(res).toEqual({ success: true });
    expect(prisma.transaction.findFirst).toHaveBeenCalled();
  });

  it("rejects a Razorpay webhook with a forged signature", async () => {
    const { svc } = makeService();
    await expect(
      svc.handleRazorpayWebhook("{}", { event: "payment.captured", payload: { payment: { entity: {} } } }, "forged"),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("accepts a Razorpay webhook with a valid signature", async () => {
    const { svc } = makeService();
    const rawBody = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_1", order_id: "ord_1" } } },
    });
    const sig = crypto.createHmac("sha256", RZP_SECRET).update(rawBody).digest("hex");
    const res = await svc.handleRazorpayWebhook(rawBody, JSON.parse(rawBody), sig);
    expect(res).toEqual({ success: true });
  });
});
