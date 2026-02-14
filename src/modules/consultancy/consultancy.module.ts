import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ConsultancyController } from "./consultancy.controller";
import { ConsultancyService } from "./consultancy.service";
import { PrismaModule } from "../../common/prisma/prisma.module";

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [ConsultancyController],
  providers: [ConsultancyService],
  exports: [ConsultancyService],
})
export class ConsultancyModule {}
