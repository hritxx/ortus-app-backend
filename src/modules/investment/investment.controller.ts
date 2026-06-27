import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { InvestmentService } from "./investment.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import {
  CreateInvestmentDto,
  UpdateInvestmentDto,
  ProcessSIPDto,
  WithdrawRequestDto,
} from "./dto/investment.dto";

@Controller("investments")
@UseGuards(JwtAuthGuard)
export class InvestmentController {
  constructor(private investmentService: InvestmentService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createInvestment(
    @Request() req,
    @Body() createInvestmentDto: CreateInvestmentDto
  ) {
    return this.investmentService.createInvestment(
      req.user.id,
      createInvestmentDto
    );
  }

  @Get("plans")
  async getAllInvestmentPlans(
    @Query("type") type?: string,
    @Query("riskLevel") riskLevel?: string
  ) {
    return this.investmentService.getAllInvestmentPlans(type, riskLevel);
  }

  @Get("plans/:planId")
  async getInvestmentPlanById(@Param("planId") planId: string) {
    return this.investmentService.getInvestmentPlanById(planId);
  }

  @Get("my")
  async getUserInvestments(@Request() req, @Query("status") status?: string) {
    return this.investmentService.getUserInvestments(req.user.id, status);
  }

  @Get("portfolio")
  async getUserPortfolio(@Request() req) {
    return this.investmentService.getUserPortfolio(req.user.id);
  }

  @Get("transactions")
  async getTransactionHistory(
    @Request() req,
    @Query("investmentId") investmentId?: string
  ) {
    return this.investmentService.getTransactionHistory(
      req.user.id,
      investmentId
    );
  }

  @Get(":investmentId")
  async getInvestmentById(
    @Request() req,
    @Param("investmentId") investmentId: string
  ) {
    return this.investmentService.getInvestmentById(req.user.id, investmentId);
  }

  @Patch(":investmentId")
  async updateInvestment(
    @Request() req,
    @Param("investmentId") investmentId: string,
    @Body() updateInvestmentDto: UpdateInvestmentDto
  ) {
    return this.investmentService.updateInvestment(
      req.user.id,
      investmentId,
      updateInvestmentDto
    );
  }

  @Post("sip/process")
  @HttpCode(HttpStatus.OK)
  async processSIPPayment(
    @Request() req,
    @Body() processSIPDto: ProcessSIPDto
  ) {
    return this.investmentService.processSIPPayment(req.user.id, processSIPDto);
  }

  @Post("withdraw")
  @HttpCode(HttpStatus.OK)
  async createWithdrawalRequest(
    @Request() req,
    @Body() withdrawRequestDto: WithdrawRequestDto
  ) {
    return this.investmentService.createWithdrawalRequest(
      req.user.id,
      withdrawRequestDto
    );
  }

  @Get("withdraw/pending")
  async getPendingWithdrawals() {
    return this.investmentService.getPendingWithdrawals();
  }

  @Post("withdraw/:transactionId/approve")
  @HttpCode(HttpStatus.OK)
  async approveWithdrawal(@Param("transactionId") transactionId: string) {
    return this.investmentService.approveWithdrawal(transactionId);
  }

  @Post("withdraw/:transactionId/reject")
  @HttpCode(HttpStatus.OK)
  async rejectWithdrawal(@Param("transactionId") transactionId: string) {
    return this.investmentService.rejectWithdrawal(transactionId);
  }
}
