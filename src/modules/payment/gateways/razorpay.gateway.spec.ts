import { ConfigService } from "@nestjs/config";
import { InternalServerErrorException } from "@nestjs/common";
import { RazorpayGateway } from "./razorpay.gateway";

describe("RazorpayGateway", () => {
  describe("without credentials (e.g. Cashfree-only deployment)", () => {
    const config = { get: () => undefined } as unknown as ConfigService;

    it("constructs without throwing so the app can boot", () => {
      expect(() => new RazorpayGateway(config)).not.toThrow();
    });

    it("rejects gateway calls with a clean error instead of crashing", async () => {
      const gateway = new RazorpayGateway(config);
      await expect(
        gateway.createOrder("user-1", { amount: 100 } as any),
      ).rejects.toThrow(InternalServerErrorException);
      await expect(gateway.getPaymentDetails("pay_x")).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe("with credentials", () => {
    const config = {
      get: (key: string) =>
        ({
          RAZORPAY_KEY_ID: "rzp_test_1234567890",
          RAZORPAY_KEY_SECRET: "secret",
        })[key],
    } as unknown as ConfigService;

    it("initializes the Razorpay client", () => {
      expect(() => new RazorpayGateway(config)).not.toThrow();
      expect((new RazorpayGateway(config) as any).razorpay).toBeTruthy();
    });
  });
});
