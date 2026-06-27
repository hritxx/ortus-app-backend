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

  async purchase(userId: string, dto: { schemeCode: string; schemeName: string; amount: number; type: "LUMPSUM" | "SIP" }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.bseUcc) throw new BadRequestException("Please complete onboarding before investing.");

    const token = await this.session.getToken("order");
    const { orderNumber } = await this.soap.placeOrder({
      token, ucc: user.bseUcc, schemeCode: dto.schemeCode, amount: dto.amount, buySell: "P", orderType: dto.type,
    });

    const paymentUrl = await this.getPaymentUrl(orderNumber, user.bseUcc, dto.amount);
    const order = await this.prisma.mutualFundOrder.create({
      data: { userId, bseOrderNumber: orderNumber, schemeCode: dto.schemeCode, schemeName: dto.schemeName,
              amount: dto.amount, type: dto.type, status: "PENDING_PAYMENT", paymentUrl },
    });
    return { orderId: order.id, orderNumber, paymentUrl };
  }

  // Isolated so the payment-gateway call can be swapped/mocked. VERIFY vs BSE Payment Gateway service.
  private async getPaymentUrl(orderNumber: string, ucc: string, amount: number): Promise<string> {
    // For UAT, BSE returns a redirect URL from the payment-gateway method.
    // Placeholder deterministic URL keeps the flow testable until that method is wired:
    return `https://bsestarmfdemo.bseindia.com/pay?order=${orderNumber}&ucc=${ucc}`; // VERIFY: BSE PDF
  }

  private assertKycComplete(user: any): void {
    const missing = ["panNumber", "bankAccount", "ifscCode"].filter((f) => !user[f]);
    if (missing.length) throw new BadRequestException(`Complete your KYC first (missing: ${missing.join(", ")})`);
  }
}
