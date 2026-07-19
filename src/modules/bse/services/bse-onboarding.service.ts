import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../common/prisma/prisma.service";
import { BseSdkClient } from "../sdk/bse-sdk.client";
import { BseConfig } from "../bse.config";
import { buildAddUccPayload } from "../mapping/ucc.mapper";

@Injectable()
export class BseOnboardingService {
  private readonly logger = new Logger(BseOnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sdk: BseSdkClient,
    private readonly cfg: BseConfig,
  ) {}

  async onboard(userId: string): Promise<{ ucc: string; fatcaRegistered: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException("User not found");
    this.assertKycComplete(user);

    let ucc = user.bseUcc ?? undefined;

    if (!ucc) {
      const clientCode = this.generateClientCode(user);
      const payload = buildAddUccPayload(
        {
          name: user.name,
          panNumber: user.panNumber,
          email: user.email,
          phone: user.phone,
          dateOfBirth: user.dateOfBirth,
          address: user.address,
          city: user.city,
          state: user.state,
          pincode: user.pincode,
          bankAccount: user.bankAccount,
          ifscCode: user.ifscCode,
        },
        clientCode,
        this.cfg.memberCode,
      );
      const res = await this.sdk.addUccPhysical(payload);
      ucc = res?.data?.client_code ?? clientCode; // we own client_code; BSE echoes it
      const status = res?.data?.status ?? "PENDING_VERIFICATION";
      await this.prisma.user.update({
        where: { id: userId },
        data: { bseUcc: ucc, bseUccStatus: status, fatcaRegistered: true },
      });
    }

    return { ucc: ucc!, fatcaRegistered: true };
  }

  /**
   * UCC status for gating orders. A physical UCC is only transaction-ready once ACTIVE
   * (after AOF/E-Log submission → BSE fires the ACTIVE webhook). Returns our stored status,
   * refreshed from get_ucc when we don't yet have an ACTIVE flag.
   */
  async getStatus(userId: string): Promise<{ ucc: string | null; status: string; active: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.bseUcc) return { ucc: null, status: "NONE", active: false };

    let status = user.bseUccStatus ?? "PENDING_VERIFICATION";
    if (status !== "ACTIVE") {
      try {
        const res = await this.sdk.getUcc({
          data: { member_code: { member_id: this.cfg.memberCode }, investor: { client_code: user.bseUcc } },
        });
        const fresh = res?.data?.ucc_status ?? res?.data?.status;
        if (fresh) {
          status = String(fresh).toUpperCase();
          if (status !== user.bseUccStatus) {
            await this.prisma.user.update({ where: { id: userId }, data: { bseUccStatus: status } });
          }
        }
      } catch (e) {
        this.logger.warn(`get_ucc status refresh failed for ${user.bseUcc}: ${(e as Error).message}`);
      }
    }
    return { ucc: user.bseUcc, status, active: status === "ACTIVE" };
  }

  /**
   * Returns the BSE 2FA e-log URL the investor must complete to activate a physical UCC.
   * (event `ucc_elog`; the app opens the returned 2fa_url in a browser.)
   */
  async getActivationLink(userId: string): Promise<{ url: string | null; event: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.bseUcc) throw new BadRequestException("Complete onboarding first.");
    // 2FA-included physical flow: PENDING_AUTH needs client auth (ucc_auth) first,
    // then e-log (ucc_elog) after third-party verification. Pick the event by status.
    const status = (user.bseUccStatus ?? "").toUpperCase();
    const event = status === "PENDING_AUTH" || status === "PENDING_AUTHENTICATION" ? "ucc_auth" : "ucc_elog";
    const res = await this.sdk.get2faLink({
      data: [
        {
          event,
          investor: { client_code: user.bseUcc, pan_holder: [user.panNumber ?? ""], holding_nature: "SI" },
          parent_client_code: "",
          member: this.cfg.memberCode,
        },
      ],
    });
    const action = (Array.isArray(res?.data) ? res.data[0] : res?.data)?.action;
    const url = action?.event_object?.[0]?.["2fa_url"] ?? null;
    return { url, event };
  }

  /**
   * Per-investor UCC client_code (NOT the member login username). Alphanumeric, uppercase.
   * CONFIRM IN UAT: BSE's length/character rules for client_code.
   */
  generateClientCode(user: { id: string }): string {
    return ("ORTUS" + user.id.replace(/[^a-zA-Z0-9]/g, "")).slice(0, 20).toUpperCase();
  }

  private assertKycComplete(user: any): void {
    const missing = ["panNumber", "bankAccount", "ifscCode"].filter((f) => !user[f]);
    if (missing.length) {
      throw new BadRequestException(`Complete your KYC first (missing: ${missing.join(", ")})`);
    }
  }
}
