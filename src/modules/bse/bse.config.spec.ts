import { BseConfig } from "./bse.config";

function makeConfig(env: Record<string, string | undefined>) {
  const configService = { get: (k: string) => env[k] } as any;
  return new BseConfig(configService);
}

describe("BseConfig", () => {
  it("reports uat as the default environment", () => {
    const cfg = makeConfig({});
    expect(cfg.env).toBe("uat");
  });

  it("exposes credentials from env", () => {
    const cfg = makeConfig({ BSE_MEMBER_CODE: "M123", BSE_USER_ID: "U1", BSE_PASSWORD: "p" });
    expect(cfg.memberCode).toBe("M123");
  });

  it("throws if a required credential is missing", () => {
    const cfg = makeConfig({ BSE_MEMBER_CODE: "M123" }); // userId/password absent
    expect(() => cfg.assertConfigured()).toThrow(/BSE_USER_ID/);
  });

  it("never includes secrets in toSafeJSON()", () => {
    const cfg = makeConfig({ BSE_MEMBER_CODE: "M123", BSE_PASSWORD: "secret" });
    expect(JSON.stringify(cfg.toSafeJSON())).not.toContain("secret");
  });
});
