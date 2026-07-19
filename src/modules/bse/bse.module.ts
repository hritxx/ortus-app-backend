import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HttpModule } from "@nestjs/axios";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { NotificationModule } from "../notification/notification.module";
import { BseConfig } from "./bse.config";
import { BseSdkClient } from "./sdk/bse-sdk.client";
import { ExchPgClient } from "./sdk/exch-pg.client";
import { BseOnboardingService } from "./services/bse-onboarding.service";
import { BseOrderService } from "./services/bse-order.service";
import { BsePaymentService } from "./services/bse-payment.service";
import { BseHoldingService } from "./services/bse-holding.service";
import { BseSchemeService } from "./services/bse-scheme.service";
import { BseController } from "./bse.controller";
import { BseWebhookController } from "./webhooks/bse-webhook.controller";
import { BseWebhookService } from "./webhooks/bse-webhook.service";
import { BseReconciliationProcessor } from "./jobs/bse-reconciliation.processor";
import { BseNotificationAdapter } from "./bse-notification.adapter";
import { NOTIFICATION_PORT } from "./bse-notification.port";

@Module({
  imports: [ConfigModule, HttpModule, PrismaModule, NotificationModule],
  controllers: [BseController, BseWebhookController],
  providers: [
    BseConfig,
    BseSdkClient,
    ExchPgClient,
    BseOnboardingService,
    BseOrderService,
    BsePaymentService,
    BseHoldingService,
    BseSchemeService,
    BseWebhookService,
    BseReconciliationProcessor,
    { provide: NOTIFICATION_PORT, useClass: BseNotificationAdapter },
  ],
  exports: [
    BseConfig,
    BseSdkClient,
    BseOnboardingService,
    BseOrderService,
    BseHoldingService,
    BseSchemeService,
    BseReconciliationProcessor,
  ],
})
export class BseModule {}
