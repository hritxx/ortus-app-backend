import { BadRequestException } from "@nestjs/common";
import { BseOnboardingService } from "./bse-onboarding.service";

function makeService(userRow: any) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(userRow),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const sdk = { addUccPhysical: jest.fn().mockResolvedValue({ data: {} }) };
  const cfg = { memberCode: "66881" };
  const svc = new BseOnboardingService(prisma as any, sdk as any, cfg as any);
  return { svc, prisma, sdk };
}

const completeUser = {
  id: "user_abc123",
  name: "Asha",
  panNumber: "ABCDE1234F",
  email: "a@b.com",
  phone: "9999999999",
  bankAccount: "123456789012",
  ifscCode: "HDFC0000001",
  bankName: "HDFC",
  bseUcc: null,
};

describe("BseOnboardingService.onboard", () => {
  it("throws when KYC is incomplete", async () => {
    const { svc } = makeService({ ...completeUser, panNumber: null });
    await expect(svc.onboard("user_abc123")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("registers a new UCC and persists it", async () => {
    const { svc, sdk, prisma } = makeService(completeUser);
    const res = await svc.onboard("user_abc123");
    expect(sdk.addUccPhysical).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ bseUcc: res.ucc }) }),
    );
    expect(res.ucc).toMatch(/^ORTUS/);
  });

  it("skips add_ucc when the user already has a UCC", async () => {
    const { svc, sdk } = makeService({ ...completeUser, bseUcc: "ORTUSEXISTING" });
    const res = await svc.onboard("user_abc123");
    expect(sdk.addUccPhysical).not.toHaveBeenCalled();
    expect(res.ucc).toBe("ORTUSEXISTING");
  });
});
