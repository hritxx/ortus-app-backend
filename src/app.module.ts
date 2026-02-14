import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";

import { PrismaModule } from "./common/prisma/prisma.module";
import { EmailModule } from "./common/services/email.module";
import { AuthModule } from "./modules/auth/auth.module";
import { PaymentModule } from "./modules/payment/payment.module";
import { InvestmentModule } from "./modules/investment/investment.module";
import { NotificationModule } from "./modules/notification/notification.module";
import { CoursesModule } from "./modules/courses/courses.module";
import { ConsultancyModule } from "./modules/consultancy/consultancy.module";
import { ChannelsModule } from "./modules/channels/channels.module";
import { AppController } from "./app.controller";

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env"],
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),

    // Core modules
    PrismaModule,
    EmailModule,

    // Feature modules
    AuthModule,
    PaymentModule,
    InvestmentModule,
    NotificationModule,
    CoursesModule,
    ConsultancyModule,
    ChannelsModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
