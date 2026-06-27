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
import { BseReconciliationProcessor } from "./jobs/bse-reconciliation.processor";
import { NotificationModule } from "../notification/notification.module";
import { BseNotificationAdapter } from "./bse-notification.adapter";
import { NOTIFICATION_PORT } from "./bse-notification.port";

@Module({
  imports: [ConfigModule, HttpModule, PrismaModule, NotificationModule],
  controllers: [BseController],
  providers: [
    BseConfig,
    BseSoapClient,
    BseSessionService,
    BseRestClient,
    BseService,
    BseReconciliationProcessor,
    BseNotificationAdapter,
    { provide: NOTIFICATION_PORT, useClass: BseNotificationAdapter },
  ],
  exports: [BseConfig, BseSoapClient, BseSessionService, BseService, BseReconciliationProcessor],
})
export class BseModule {}
