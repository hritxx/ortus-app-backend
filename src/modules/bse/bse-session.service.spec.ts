import { BseSessionService } from "./bse-session.service";

function makeService(getPassword = jest.fn().mockResolvedValue("TOKEN1")) {
  const soap = { getPassword } as any;
  const svc = new BseSessionService(soap);
  return { svc, getPassword };
}

describe("BseSessionService", () => {
  it("fetches a token on first use", async () => {
    const { svc, getPassword } = makeService();
    expect(await svc.getToken("order")).toBe("TOKEN1");
    expect(getPassword).toHaveBeenCalledTimes(1);
  });

  it("reuses the cached token within its TTL", async () => {
    const { svc, getPassword } = makeService();
    await svc.getToken("order");
    await svc.getToken("order");
    expect(getPassword).toHaveBeenCalledTimes(1);
  });

  it("refreshes after the TTL expires", async () => {
    const getPassword = jest.fn().mockResolvedValueOnce("T1").mockResolvedValueOnce("T2");
    const { svc } = makeService(getPassword);
    jest.spyOn(Date, "now").mockReturnValue(0);
    await svc.getToken("other");                 // fetch T1 at t=0
    (Date.now as jest.Mock).mockReturnValue(5 * 60 * 1000); // +5 min > 4 min TTL
    expect(await svc.getToken("other")).toBe("T2");
    (Date.now as jest.Mock).mockRestore();
  });

  it("generates an alphanumeric PassKey with no special characters", async () => {
    const getPassword = jest.fn().mockResolvedValue("T");
    const { svc } = makeService(getPassword);
    await svc.getToken("order");
    const passKey = getPassword.mock.calls[0][0];
    expect(passKey).toMatch(/^[A-Za-z0-9]+$/);
  });
});
