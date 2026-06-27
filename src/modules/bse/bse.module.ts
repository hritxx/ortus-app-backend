import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HttpModule } from "@nestjs/axios";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { BseConfig } from "./bse.config";

@Module({
  imports: [ConfigModule, HttpModule, PrismaModule],
  providers: [BseConfig],
  exports: [BseConfig],
})
export class BseModule {}
