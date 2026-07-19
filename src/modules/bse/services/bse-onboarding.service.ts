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
      await this.sdk.addUccPhysical(payload);
      ucc = clientCode; // we own client_code; BSE echoes it on success
      await this.prisma.user.update({
        where: { id: userId },
        data: { bseUcc: ucc, fatcaRegistered: true },
      });
    }

    return { ucc: ucc!, fatcaRegistered: true };
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
