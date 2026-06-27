import { Module } from "@nestjs/common";
import { PaymentController } from "./payment.controller";
import { PaymentService } from "./payment.service";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { ConfigModule } from "@nestjs/config";
import { RazorpayGateway } from "./gateways/razorpay.gateway";
import { CashfreeGateway } from "./gateways/cashfree.gateway";

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [PaymentController],
  providers: [PaymentService, RazorpayGateway, CashfreeGateway],
  exports: [PaymentService, RazorpayGateway, CashfreeGateway],
})
export class PaymentModule {}
