import { Injectable, BadRequestException, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { BseRestClient } from "./bse-rest.client";
import { BseSoapClient } from "./bse-soap.client";
import { BseSessionService } from "./bse-session.service";

@Injectable()
export class BseService {
  private readonly logger = new Logger(BseService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly rest: BseRestClient,
    private readonly soap: BseSoapClient,
    private readonly session: BseSessionService,
  ) {}

  async onboard(userId: string): Promise<{ ucc: string; fatcaRegistered: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException("User not found");
    this.assertKycComplete(user);

    let ucc = user.bseUcc ?? undefined;
    let fatca = user.fatcaRegistered;

    if (!ucc) {
      const clientCode = userId.slice(-10).toUpperCase();           // VERIFY UCC format rules vs PDF
      const res = await this.rest.registerUcc({
        clientCode, firstName: user.name ?? "Investor", pan: user.panNumber!,
        holdingMode: "SI", taxStatus: "01", bankAccount: user.bankAccount!, ifsc: user.ifscCode!,
        accountType: "SB", email: user.email, mobile: user.phone ?? "", allotmentMode: "PHYSICAL",
      });
      ucc = res.ucc;
    }
    if (!fatca) {
      await this.rest.registerFatca({ clientCode: ucc, pan: user.panNumber!, birthCountry: "IN", taxResidency: "IN" });
      fatca = true;
    }
    await this.prisma.user.update({ where: { id: userId }, data: { bseUcc: ucc, fatcaRegistered: fatca } });
    return { ucc, fatcaRegistered: fatca };
  }

  private assertKycComplete(user: any): void {
    const missing = ["panNumber", "bankAccount", "ifscCode"].filter((f) => !user[f]);
    if (missing.length) throw new BadRequestException(`Complete your KYC first (missing: ${missing.join(", ")})`);
  }
}
