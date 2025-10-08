import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import {
  CreateInvestmentDto,
  UpdateInvestmentDto,
  ProcessSIPDto,
} from "./dto/investment.dto";

@Injectable()
export class InvestmentService {
  private readonly logger = new Logger(InvestmentService.name);

  constructor(private prisma: PrismaService) {}

  async createInvestment(
    userId: string,
    createInvestmentDto: CreateInvestmentDto
  ) {
    const {
      planId,
      amountInvested,
      sipAmount,
      swpAmount,
      nextSipDate,
      paymentMethod,
      notes,
    } = createInvestmentDto;

    // Verify investment plan exists
    const plan = await this.prisma.investmentPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundException("Investment plan not found");
    }

    if (!plan.isActive) {
      throw new BadRequestException("Investment plan is not active");
    }

    // Validate investment amount
    if (amountInvested < plan.minimumInvestment) {
      throw new BadRequestException(
        `Minimum investment amount is ₹${plan.minimumInvestment}`
      );
    }

    if (plan.maximumInvestment && amountInvested > plan.maximumInvestment) {
      throw new BadRequestException(
        `Maximum investment amount is ₹${plan.maximumInvestment}`
      );
    }

    // Calculate maturity date based on lock-in period
    const maturityDate = new Date();
    maturityDate.setMonth(maturityDate.getMonth() + plan.lockInPeriod);

    // Create investment
    const investment = await this.prisma.investment.create({
      data: {
        userId,
        planId,
        amountInvested,
        currentValue: amountInvested,
        returns: 0,
        returnsPercentage: 0,
        maturityDate,
        sipAmount: plan.type === "SIP" ? sipAmount : null,
        swpAmount: plan.type === "SWP" ? swpAmount : null,
        nextSipDate:
          plan.type === "SIP" && nextSipDate ? new Date(nextSipDate) : null,
        status: "ACTIVE",
      },
      include: {
        plan: true,
      },
    });

    // Allocate fixed tokens for investment signup
    await this.allocateTokens(userId, investment.id, planId, plan.fixedTokens);

    this.logger.log(`Investment created: ${investment.id} for user: ${userId}`);

    return {
      success: true,
      investment,
      tokensEarned: plan.fixedTokens,
    };
  }

  async getAllInvestmentPlans(type?: string, riskLevel?: string) {
    const where: any = {
      isActive: true,
    };

    if (type) {
      where.type = type;
    }

    if (riskLevel) {
      where.riskLevel = riskLevel;
    }

    const plans = await this.prisma.investmentPlan.findMany({
      where,
      orderBy: {
        interestRate: "desc",
      },
    });

    return {
      success: true,
      count: plans.length,
      plans,
    };
  }

  async getInvestmentPlanById(planId: string) {
    const plan = await this.prisma.investmentPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundException("Investment plan not found");
    }

    return {
      success: true,
      plan,
    };
  }

  async getUserInvestments(userId: string, status?: string) {
    const where: any = { userId };

    if (status) {
      where.status = status;
    }

    const investments = await this.prisma.investment.findMany({
      where,
      include: {
        plan: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return {
      success: true,
      count: investments.length,
      investments,
    };
  }

  async getInvestmentById(userId: string, investmentId: string) {
    const investment = await this.prisma.investment.findFirst({
      where: {
        id: investmentId,
        userId,
      },
      include: {
        plan: true,
        transactions: {
          orderBy: {
            createdAt: "desc",
          },
          take: 10,
        },
      },
    });

    if (!investment) {
      throw new NotFoundException("Investment not found");
    }

    return {
      success: true,
      investment,
    };
  }

  async updateInvestment(
    userId: string,
    investmentId: string,
    updateInvestmentDto: UpdateInvestmentDto
  ) {
    const investment = await this.prisma.investment.findFirst({
      where: {
        id: investmentId,
        userId,
      },
    });

    if (!investment) {
      throw new NotFoundException("Investment not found");
    }

    const updated = await this.prisma.investment.update({
      where: { id: investmentId },
      data: {
        ...(updateInvestmentDto.sipAmount && {
          sipAmount: updateInvestmentDto.sipAmount,
        }),
        ...(updateInvestmentDto.swpAmount && {
          swpAmount: updateInvestmentDto.swpAmount,
        }),
        ...(updateInvestmentDto.nextSipDate && {
          nextSipDate: new Date(updateInvestmentDto.nextSipDate),
        }),
        ...(updateInvestmentDto.status && {
          status: updateInvestmentDto.status as any,
        }),
      },
      include: {
        plan: true,
      },
    });

    this.logger.log(`Investment updated: ${investmentId} for user: ${userId}`);

    return {
      success: true,
      investment: updated,
    };
  }

  async getUserPortfolio(userId: string) {
    const investments = await this.prisma.investment.findMany({
      where: {
        userId,
        status: "ACTIVE",
      },
      include: {
        plan: true,
      },
    });

    const totalInvested = investments.reduce(
      (sum, inv) => sum + Number(inv.amountInvested),
      0
    );
    const currentValue = investments.reduce(
      (sum, inv) => sum + Number(inv.currentValue),
      0
    );
    const totalReturns = currentValue - totalInvested;
    const returnsPercentage =
      totalInvested > 0 ? (totalReturns / totalInvested) * 100 : 0;

    // Get user's token balance
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { tokenBalance: true },
    });

    // Get recent token transactions
    const tokenTransactions = await this.prisma.tokenTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    return {
      success: true,
      portfolio: {
        totalInvested,
        currentValue,
        totalReturns,
        returnsPercentage: Number(returnsPercentage.toFixed(2)),
        totalInvestments: investments.length,
        tokenBalance: user?.tokenBalance || 0,
      },
      investments,
      recentTokenTransactions: tokenTransactions,
    };
  }

  async processSIPPayment(userId: string, processSIPDto: ProcessSIPDto) {
    const { investmentId, paymentId, amount } = processSIPDto;

    const investment = await this.prisma.investment.findFirst({
      where: {
        id: investmentId,
        userId,
      },
      include: {
        plan: true,
      },
    });

    if (!investment) {
      throw new NotFoundException("Investment not found");
    }

    if (investment.plan.type !== "SIP") {
      throw new BadRequestException("This is not a SIP investment");
    }

    // Update investment amounts
    const newAmountInvested = Number(investment.amountInvested) + amount;
    const estimatedReturns =
      (newAmountInvested * Number(investment.plan.interestRate)) / 100;
    const newCurrentValue = newAmountInvested + estimatedReturns;

    await this.prisma.investment.update({
      where: { id: investmentId },
      data: {
        amountInvested: newAmountInvested,
        currentValue: newCurrentValue,
        returns: estimatedReturns,
        returnsPercentage: investment.plan.interestRate,
        nextSipDate: this.calculateNextSIPDate(investment.nextSipDate),
      },
    });

    // Create transaction record
    await this.prisma.transaction.create({
      data: {
        userId,
        investmentId,
        type: "SIP_PAYMENT",
        amount,
        status: "COMPLETED",
        paymentMethod: "Auto Debit",
        razorpayPaymentId: paymentId,
        description: `SIP payment for ${investment.plan.name}`,
        processedAt: new Date(),
      },
    });

    // Allocate random tokens for periodic payment
    const randomTokens = this.generateRandomTokens(
      investment.plan.minPeriodicTokens,
      investment.plan.maxPeriodicTokens
    );
    await this.allocatePeriodicTokens(
      userId,
      investmentId,
      investment.planId,
      randomTokens
    );

    this.logger.log(
      `SIP payment processed: ${paymentId} for investment: ${investmentId}`
    );

    return {
      success: true,
      message: "SIP payment processed successfully",
      tokensEarned: randomTokens,
    };
  }

  private async allocateTokens(
    userId: string,
    investmentId: string,
    planId: string,
    tokens: number
  ) {
    // Get current user token balance
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { tokenBalance: true },
    });

    const newBalance = (user?.tokenBalance || 0) + tokens;

    // Update user token balance
    await this.prisma.user.update({
      where: { id: userId },
      data: { tokenBalance: newBalance },
    });

    // Create token transaction record
    await this.prisma.tokenTransaction.create({
      data: {
        userId,
        investmentId,
        planId,
        type: "INVESTMENT_SIGNUP",
        amount: tokens,
        balance: newBalance,
        source: "investment_signup",
        description: "Tokens earned for new investment",
      },
    });

    this.logger.log(`Allocated ${tokens} tokens to user: ${userId}`);
  }

  private async allocatePeriodicTokens(
    userId: string,
    investmentId: string,
    planId: string,
    tokens: number
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { tokenBalance: true },
    });

    const newBalance = (user?.tokenBalance || 0) + tokens;

    await this.prisma.user.update({
      where: { id: userId },
      data: { tokenBalance: newBalance },
    });

    await this.prisma.tokenTransaction.create({
      data: {
        userId,
        investmentId,
        planId,
        type: "PERIODIC_PAYMENT",
        amount: tokens,
        balance: newBalance,
        source: "periodic_payment",
        description: "Random tokens earned for SIP payment",
      },
    });

    this.logger.log(`Allocated ${tokens} periodic tokens to user: ${userId}`);
  }

  private generateRandomTokens(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private calculateNextSIPDate(currentDate: Date | null): Date {
    const nextDate = currentDate ? new Date(currentDate) : new Date();
    nextDate.setMonth(nextDate.getMonth() + 1);
    return nextDate;
  }

  async getTransactionHistory(userId: string, investmentId?: string) {
    const where: any = { userId };

    if (investmentId) {
      where.investmentId = investmentId;
    }

    const transactions = await this.prisma.transaction.findMany({
      where,
      include: {
        investment: {
          include: {
            plan: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return {
      success: true,
      count: transactions.length,
      transactions,
    };
  }
}
