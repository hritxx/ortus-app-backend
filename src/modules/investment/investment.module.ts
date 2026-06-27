import { Module } from "@nestjs/common";
import { InvestmentController } from "./investment.controller";
import { InvestmentService } from "./investment.service";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { NotificationModule } from "../notification/notification.module";

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [InvestmentController],
  providers: [InvestmentService],
  exports: [InvestmentService],
})
export class InvestmentModule {}
