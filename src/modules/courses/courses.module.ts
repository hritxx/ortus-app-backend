import { Module } from "@nestjs/common";
import { CoursesController } from "./courses.controller";
import { CoursesService } from "./courses.service";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { ConfigModule } from "@nestjs/config";

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [CoursesController],
  providers: [CoursesService],
  exports: [CoursesService],
})
export class CoursesModule {}
