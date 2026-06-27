import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { BseService } from "./bse.service";
import { PurchaseDto } from "./dto/purchase.dto";

@Controller("bse")
@UseGuards(JwtAuthGuard)
export class BseController {
  constructor(private readonly bse: BseService) {}

  @Post("onboard")
  @HttpCode(HttpStatus.OK)
  onboard(@Request() req) {
    return this.bse.onboard(req.user.id);
  }

  @Post("purchase")
  @HttpCode(HttpStatus.CREATED)
  purchase(@Request() req, @Body() dto: PurchaseDto) {
    return this.bse.purchase(req.user.id, dto);
  }

  @Get("order/:id/status")
  status(@Param("id") id: string) {
    return this.bse.syncOrderStatus(id);
  }

  @Get("funds")
  funds(@Query("search") search?: string, @Query("category") category?: string) {
    return this.bse.listFunds(search, category);
  }
}
