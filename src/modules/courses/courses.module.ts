import { Module } from "@nestjs/common";
import { CoursesController } from "./courses.controller";
import { CoursesService } from "./courses.service";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { ConfigModule } from "@nestjs/config";
import { NotificationModule } from "../notification/notification.module";
import { PaymentModule } from "../payment/payment.module";

@Module({
  imports: [PrismaModule, ConfigModule, NotificationModule, PaymentModule],
  controllers: [CoursesController],
  providers: [CoursesService],
  exports: [CoursesService],
})
export class CoursesModule {}
