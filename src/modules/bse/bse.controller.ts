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
import { BseOnboardingService } from "./services/bse-onboarding.service";
import { BseOrderService } from "./services/bse-order.service";
import { BsePaymentService } from "./services/bse-payment.service";
import { BseHoldingService } from "./services/bse-holding.service";
import { BseSchemeService } from "./services/bse-scheme.service";
import { PurchaseDto } from "./dto/purchase.dto";
import { RedeemDto } from "./dto/redeem.dto";

@Controller("bse")
@UseGuards(JwtAuthGuard)
export class BseController {
  constructor(
    private readonly onboarding: BseOnboardingService,
    private readonly orders: BseOrderService,
    private readonly payment: BsePaymentService,
    private readonly holdings: BseHoldingService,
    private readonly schemes: BseSchemeService,
  ) {}

  @Get("funds")
  funds(@Query("search") search?: string, @Query("category") category?: string) {
    return this.schemes.listFunds(search, category);
  }

  @Post("onboard")
  @HttpCode(HttpStatus.OK)
  onboard(@Request() req) {
    return this.onboarding.onboard(req.user.id);
  }

  @Get("onboard/status")
  onboardStatus(@Request() req) {
    return this.onboarding.getStatus(req.user.id);
  }

  @Post("onboard/activation-link")
  @HttpCode(HttpStatus.OK)
  activationLink(@Request() req) {
    return this.onboarding.getActivationLink(req.user.id);
  }

  @Post("purchase")
  @HttpCode(HttpStatus.CREATED)
  purchase(@Request() req, @Body() dto: PurchaseDto) {
    return this.orders.purchase(req.user.id, dto);
  }

  @Post("redeem")
  @HttpCode(HttpStatus.CREATED)
  redeem(@Request() req, @Body() dto: RedeemDto) {
    return this.orders.redeem(req.user.id, dto);
  }

  @Get("order/:id/status")
  status(@Param("id") id: string, @Request() req) {
    return this.orders.syncOrderStatus(id, req.user.id);
  }

  @Get("orders")
  listOrders(@Request() req) {
    return this.orders.listOrders(req.user.id);
  }

  @Get("holdings")
  holdingsList(@Request() req) {
    return this.holdings.listHoldings(req.user.id);
  }

  @Post("payment/confirm")
  @HttpCode(HttpStatus.OK)
  confirmPayment(@Body() body: any) {
    return this.payment.confirmPayment(body);
  }
}
