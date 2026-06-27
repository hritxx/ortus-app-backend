import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HttpModule } from "@nestjs/axios";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { BseConfig } from "./bse.config";
import { BseSoapClient } from "./bse-soap.client";
import { BseSessionService } from "./bse-session.service";

@Module({
  imports: [ConfigModule, HttpModule, PrismaModule],
  providers: [BseConfig, BseSoapClient, BseSessionService],
  exports: [BseConfig, BseSoapClient, BseSessionService],
})
export class BseModule {}
