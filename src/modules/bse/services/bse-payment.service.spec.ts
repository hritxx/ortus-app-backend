import { BsePaymentService } from "./bse-payment.service";

describe("BsePaymentService", () => {
  it("gets a payment URL via the exchange PG", async () => {
    const exchPg = {
      getExchPgService: jest
        .fn()
        .mockResolvedValue({ redirectUrl: "https://pay/redir", raw: { data: { payment_ref_id: "PR1" } } }),
    };
    const cfg = { memberCode: "66881" };
    const svc = new BsePaymentService(exchPg as any, cfg as any);
    const res = await svc.getPaymentUrl("50001234", "ORTUS0001", 5000);
    expect(res.paymentUrl).toBe("https://pay/redir");
    expect(res.paymentRefId).toBe("PR1");
    expect(exchPg.getExchPgService).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          order_ids: [50001234],
          investor: { ucc: "ORTUS0001" },
          requested_method: "exch_pg_page",
        }),
      }),
    );
  });
});
