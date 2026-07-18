import { of } from "rxjs";
import { ExchPgClient } from "./exch-pg.client";

function makeClient(responseBody: any) {
  const http = { post: jest.fn().mockReturnValue(of({ data: responseBody })) };
  const cfg = { baseUrl: "https://starmfv2demo.bseindia.com" };
  const sdk = { getToken: jest.fn().mockResolvedValue("tok-1") };
  return { client: new ExchPgClient(http as any, cfg as any, sdk as any), http };
}

describe("ExchPgClient.getExchPgService", () => {
  it("posts to /api/get_exchpg_service with a bearer token", async () => {
    const { client, http } = makeClient({ data: { redirect_url: "https://pay.bse/redir" } });
    await client.getExchPgService({ order_id: 1 });
    expect(http.post).toHaveBeenCalledWith(
      "https://starmfv2demo.bseindia.com/api/get_exchpg_service",
      { order_id: 1 },
      { headers: expect.objectContaining({ Authorization: "Bearer tok-1" }) },
    );
  });

  it("extracts the redirect URL from the response", async () => {
    const { client } = makeClient({ data: { redirect_url: "https://pay.bse/redir" } });
    const res = await client.getExchPgService({ order_id: 1 });
    expect(res.redirectUrl).toBe("https://pay.bse/redir");
  });

  it("tolerates alternate URL field names", async () => {
    const { client } = makeClient({ payment_url: "https://pay.bse/alt" });
    const res = await client.getExchPgService({ order_id: 1 });
    expect(res.redirectUrl).toBe("https://pay.bse/alt");
  });
});
