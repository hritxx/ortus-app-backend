import { Module } from "@nestjs/common";
import { InvestmentController } from "./investment.controller";
import { InvestmentService } from "./investment.service";
import { PrismaModule } from "../../common/prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [InvestmentController],
  providers: [InvestmentService],
  exports: [InvestmentService],
})
export class InvestmentModule {}
