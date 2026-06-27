import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HttpModule } from "@nestjs/axios";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { BseConfig } from "./bse.config";
import { BseSoapClient } from "./bse-soap.client";
import { BseSessionService } from "./bse-session.service";
import { BseRestClient } from "./bse-rest.client";
import { BseService } from "./bse.service";
import { BseController } from "./bse.controller";

@Module({
  imports: [ConfigModule, HttpModule, PrismaModule],
  controllers: [BseController],
  providers: [BseConfig, BseSoapClient, BseSessionService, BseRestClient, BseService],
  exports: [BseConfig, BseSoapClient, BseSessionService, BseService],
})
export class BseModule {}
