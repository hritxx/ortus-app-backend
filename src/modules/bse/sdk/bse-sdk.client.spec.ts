const loginMock = jest.fn();

jest.mock("bse-starmfv2-sdk", () => {
  class BseLoginService {
    login = (...args: any[]) => loginMock(...args);
  }
  class Stub {}
  return {
    BseLoginService,
    UccService: Stub,
    TrxnService: Stub,
    MasterDataService: Stub,
    NavService: Stub,
  };
});

import { BseSdkClient } from "./bse-sdk.client";
import { BseConfig } from "../bse.config";
import { BseError } from "../mapping/bse-error.map";

function makeCfg(overrides: Partial<Record<string, string>> = {}): BseConfig {
  const env: Record<string, string> = {
    BSE_BASE_URL: "https://starmfv2demo.bseindia.com",
    BSE_USERNAME: "member/66881/ortus",
    BSE_PASSWORD: "Member@123",
    BSE_MEMBER_CODE: "66881",
    BSE_TOKEN_TTL_MS: "60000",
    ...overrides,
  };
  return new BseConfig({ get: (k: string) => env[k] } as any);
}

describe("BseSdkClient", () => {
  beforeEach(() => loginMock.mockReset());

  it("returns the access token from login", async () => {
    loginMock.mockResolvedValue({ data: { access_token: "tok-1" } });
    const client = new BseSdkClient(makeCfg());
    await expect(client.getToken()).resolves.toBe("tok-1");
    expect(loginMock).toHaveBeenCalledTimes(1);
  });

  it("caches the token within TTL (no second login)", async () => {
    loginMock.mockResolvedValue({ data: { access_token: "tok-1" } });
    const client = new BseSdkClient(makeCfg());
    await client.getToken();
    await client.getToken();
    expect(loginMock).toHaveBeenCalledTimes(1);
  });

  it("serializes concurrent refreshes into a single login", async () => {
    let resolve: (v: any) => void = () => {};
    loginMock.mockReturnValue(new Promise((r) => (resolve = r)));
    const client = new BseSdkClient(makeCfg());
    const p1 = client.getToken();
    const p2 = client.getToken();
    resolve({ data: { access_token: "tok-1" } });
    await expect(Promise.all([p1, p2])).resolves.toEqual(["tok-1", "tok-1"]);
    expect(loginMock).toHaveBeenCalledTimes(1);
  });

  it("re-logs in after invalidateToken()", async () => {
    loginMock.mockResolvedValue({ data: { access_token: "tok-1" } });
    const client = new BseSdkClient(makeCfg());
    await client.getToken();
    client.invalidateToken();
    await client.getToken();
    expect(loginMock).toHaveBeenCalledTimes(2);
  });

  it("throws BseError when login returns no token", async () => {
    loginMock.mockResolvedValue({ status: 401, errorMsg: "bad creds" });
    const client = new BseSdkClient(makeCfg());
    await expect(client.getToken()).rejects.toBeInstanceOf(BseError);
  });
});
