import { BseService } from "./bse.service";

function make(user: any) {
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(user), update: jest.fn().mockResolvedValue({}) },
  } as any;
  const rest = {
    registerUcc: jest.fn().mockResolvedValue({ ucc: "UCC1" }),
    registerFatca: jest.fn().mockResolvedValue(undefined),
  } as any;
  const svc = new BseService(prisma, rest, {} as any, {} as any, {} as any);
  return { svc, prisma, rest };
}

const fullUser = { id: "u1", bseUcc: null, fatcaRegistered: false, firstName: "A", panNumber: "ABCDE1234F", bankAccount: "1", ifscCode: "IFSC", email: "a@b.c", phone: "9", name: "A" };

describe("BseService.onboard", () => {
  it("registers UCC + FATCA for a new investor and persists them", async () => {
    const { svc, prisma, rest } = make(fullUser);
    const res = await svc.onboard("u1");
    expect(rest.registerUcc).toHaveBeenCalledTimes(1);
    expect(rest.registerFatca).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ bseUcc: "UCC1", fatcaRegistered: true }) }));
    expect(res.ucc).toBe("UCC1");
  });

  it("is idempotent — skips UCC when already registered", async () => {
    const { svc, rest } = make({ ...fullUser, bseUcc: "EXISTING", fatcaRegistered: true });
    const res = await svc.onboard("u1");
    expect(rest.registerUcc).not.toHaveBeenCalled();
    expect(rest.registerFatca).not.toHaveBeenCalled();
    expect(res.ucc).toBe("EXISTING");
  });

  it("rejects onboarding when KYC fields are missing", async () => {
    const { svc } = make({ id: "u1", bseUcc: null, panNumber: null });
    await expect(svc.onboard("u1")).rejects.toThrow(/PAN/i);
  });
});
