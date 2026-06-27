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
  WithdrawRequestDto,
} from "./dto/investment.dto";
import { calculateCompoundedValue } from "./compounding";
import { NotificationService } from "../notification/notification.service";
import { EmailService } from "../../common/services/email.service";

@Injectable()
export class InvestmentService {
  private readonly logger = new Logger(InvestmentService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private emailService: EmailService
  ) {}

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
        transactions: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const updatedInvestments = investments.map((inv) => {
      const compounded = calculateCompoundedValue(inv, inv.transactions);
      return {
        ...inv,
        planName: inv.plan?.name,
        currentValue: compounded.currentValue,
        returns: compounded.returns,
        returnsPercentage: compounded.returnsPercentage,
      };
    });

    return {
      success: true,
      count: updatedInvestments.length,
      investments: updatedInvestments,
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

    // Fetch all completed transactions for full compounding calculation
    const allTransactions = await this.prisma.transaction.findMany({
      where: { investmentId: investment.id },
    });

    const compounded = calculateCompoundedValue(investment, allTransactions);

    return {
      success: true,
      investment: {
        ...investment,
        planName: investment.plan?.name,
        currentValue: compounded.currentValue,
        returns: compounded.returns,
        returnsPercentage: compounded.returnsPercentage,
      },
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
        transactions: true,
      },
    });

    const updatedInvestments = investments.map((inv) => {
      const compounded = calculateCompoundedValue(inv, inv.transactions);
      return {
        ...inv,
        planName: inv.plan?.name,
        currentValue: compounded.currentValue,
        returns: compounded.returns,
        returnsPercentage: compounded.returnsPercentage,
      };
    });

    const totalInvested = updatedInvestments.reduce(
      (sum, inv) => sum + Number(inv.amountInvested),
      0
    );
    const currentValue = updatedInvestments.reduce(
      (sum, inv) => sum + Number(inv.currentValue),
      0
    );
    const totalReturns = currentValue - totalInvested;
    const returnsPercentage =
      totalInvested > 0 ? (totalReturns / totalInvested) * 100 : 0;

    // Calculate asset allocation breakdown based on current value weights
    let totalEquityValue = 0;
    let totalDebtValue = 0;
    let totalGoldValue = 0;
    let totalCashValue = 0;

    updatedInvestments.forEach((inv) => {
      const val = inv.currentValue;
      const plan = inv.plan;
      totalEquityValue += val * (plan.equityAllocation / 100);
      totalDebtValue += val * (plan.debtAllocation / 100);
      totalGoldValue += val * (plan.goldAllocation / 100);
      totalCashValue += val * (plan.cashAllocation / 100);
    });

    const totalAllocatedValue = totalEquityValue + totalDebtValue + totalGoldValue + totalCashValue;

    const assetAllocation = {
      equity: totalAllocatedValue > 0 ? Number(((totalEquityValue / totalAllocatedValue) * 100).toFixed(2)) : 0,
      debt: totalAllocatedValue > 0 ? Number(((totalDebtValue / totalAllocatedValue) * 100).toFixed(2)) : 0,
      gold: totalAllocatedValue > 0 ? Number(((totalGoldValue / totalAllocatedValue) * 100).toFixed(2)) : 0,
      cash: totalAllocatedValue > 0 ? Number(((totalCashValue / totalAllocatedValue) * 100).toFixed(2)) : 0,
    };

    // If active investments exist but allocations are unconfigured (all zero), return a balanced fallback
    if (totalAllocatedValue === 0 && updatedInvestments.length > 0) {
      assetAllocation.equity = 40;
      assetAllocation.debt = 30;
      assetAllocation.gold = 15;
      assetAllocation.cash = 15;
    }

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
        totalInvestments: updatedInvestments.length,
        tokenBalance: user?.tokenBalance || 0,
        assetAllocation,
      },
      investments: updatedInvestments,
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

    // Create transaction record first
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

    // Get all completed transactions to calculate dynamic compounded value
    const allTransactions = await this.prisma.transaction.findMany({
      where: { investmentId: investment.id, status: "COMPLETED" },
    });

    const compounded = calculateCompoundedValue(investment, allTransactions);
    
    const totalDeposits = allTransactions
      .filter((tx) => tx.type === "INVESTMENT" || tx.type === "SIP_PAYMENT")
      .reduce((sum, tx) => sum + tx.amount, 0);
    const totalWithdrawals = allTransactions
      .filter((tx) => tx.type === "WITHDRAWAL")
      .reduce((sum, tx) => sum + tx.amount, 0);
    const netInvested = Math.max(0, totalDeposits - totalWithdrawals);

    await this.prisma.investment.update({
      where: { id: investmentId },
      data: {
        amountInvested: netInvested,
        currentValue: compounded.currentValue,
        returns: compounded.returns,
        returnsPercentage: compounded.returnsPercentage,
        nextSipDate: this.calculateNextSIPDate(investment.nextSipDate),
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

  async createWithdrawalRequest(userId: string, dto: WithdrawRequestDto) {
    const { investmentId, amount } = dto;

    const investment = await this.prisma.investment.findFirst({
      where: { id: investmentId, userId },
      include: { plan: true },
    });

    if (!investment) {
      throw new NotFoundException("Investment not found");
    }

    // Fetch all completed transactions for full compounding calculation
    const allTransactions = await this.prisma.transaction.findMany({
      where: { investmentId },
    });

    const compounded = calculateCompoundedValue(investment, allTransactions);

    if (amount > compounded.currentValue) {
      throw new BadRequestException(
        `Withdrawal amount of ₹${amount} exceeds the current investment value of ₹${compounded.currentValue}`
      );
    }

    // Create withdrawal transaction in PENDING status
    const transaction = await this.prisma.transaction.create({
      data: {
        userId,
        investmentId,
        type: "WITHDRAWAL",
        amount,
        status: "PENDING",
        description: `Withdrawal request for ${investment.plan.name}`,
      },
    });

    return {
      success: true,
      message: "Withdrawal request raised successfully",
      transaction,
    };
  }

  async getPendingWithdrawals() {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        type: "WITHDRAWAL",
        status: "PENDING",
      },
      include: {
        user: true,
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

  async approveWithdrawal(transactionId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        user: true,
        investment: {
          include: {
            plan: true,
          },
        },
      },
    });

    if (!transaction || transaction.type !== "WITHDRAWAL") {
      throw new NotFoundException("Withdrawal transaction not found");
    }

    if (transaction.status !== "PENDING") {
      throw new BadRequestException(`Withdrawal is already in ${transaction.status} state`);
    }

    // Mark transaction as COMPLETED
    const updatedTransaction = await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: "COMPLETED",
        processedAt: new Date(),
      },
    });

    // Re-calculate the investment totals and update the Investment table cache
    if (transaction.investment) {
      const allTransactions = await this.prisma.transaction.findMany({
        where: { investmentId: transaction.investmentId, status: "COMPLETED" },
      });

      const compounded = calculateCompoundedValue(transaction.investment, allTransactions);

      const totalDeposits = allTransactions
        .filter((tx) => tx.type === "INVESTMENT" || tx.type === "SIP_PAYMENT")
        .reduce((sum, tx) => sum + tx.amount, 0);
      const totalWithdrawals = allTransactions
        .filter((tx) => tx.type === "WITHDRAWAL")
        .reduce((sum, tx) => sum + tx.amount, 0);
      const netInvested = Math.max(0, totalDeposits - totalWithdrawals);

      // If the entire investment has been withdrawn (currentValue is 0), mark the investment as WITHDRAWN
      const newStatus = compounded.currentValue <= 0 ? "WITHDRAWN" : "ACTIVE";

      await this.prisma.investment.update({
        where: { id: transaction.investmentId },
        data: {
          amountInvested: netInvested,
          currentValue: compounded.currentValue,
          returns: compounded.returns,
          returnsPercentage: compounded.returnsPercentage,
          status: newStatus as any,
        },
      });
    }

    // Send email to user
    try {
      await this.emailService.sendWithdrawalEmail(
        transaction.user.email,
        transaction.user.name || "Investor",
        transaction.amount,
        transaction.investment?.plan.name || "Investment Plan",
        "APPROVED"
      );
    } catch (emailError) {
      this.logger.error(`Failed to send withdrawal approval email to ${transaction.user.email}:`, emailError);
    }

    // Send Push & In-app Notification
    try {
      await this.notificationService.createNotification({
        userId: transaction.userId,
        title: "Withdrawal Approved 🎉",
        body: `Your withdrawal of ₹${transaction.amount.toLocaleString()} from ${transaction.investment?.plan.name || "Investment"} has been approved and processed.`,
        type: "SUCCESS",
        category: "TRANSACTION",
      });
    } catch (pushError) {
      this.logger.error("Failed to create approval notification:", pushError);
    }

    return {
      success: true,
      message: "Withdrawal request approved successfully",
      transaction: updatedTransaction,
    };
  }

  async rejectWithdrawal(transactionId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        user: true,
        investment: {
          include: {
            plan: true,
          },
        },
      },
    });

    if (!transaction || transaction.type !== "WITHDRAWAL") {
      throw new NotFoundException("Withdrawal transaction not found");
    }

    if (transaction.status !== "PENDING") {
      throw new BadRequestException(`Withdrawal is already in ${transaction.status} state`);
    }

    // Mark transaction as FAILED
    const updatedTransaction = await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: "FAILED",
        processedAt: new Date(),
      },
    });

    // Send email to user
    try {
      await this.emailService.sendWithdrawalEmail(
        transaction.user.email,
        transaction.user.name || "Investor",
        transaction.amount,
        transaction.investment?.plan.name || "Investment Plan",
        "REJECTED"
      );
    } catch (emailError) {
      this.logger.error(`Failed to send withdrawal rejection email to ${transaction.user.email}:`, emailError);
    }

    // Send Push & In-app Notification
    try {
      await this.notificationService.createNotification({
        userId: transaction.userId,
        title: "Withdrawal Rejected",
        body: `Your withdrawal request of ₹${transaction.amount.toLocaleString()} from ${transaction.investment?.plan.name || "Investment"} was rejected.`,
        type: "ERROR",
        category: "TRANSACTION",
      });
    } catch (pushError) {
      this.logger.error("Failed to create rejection notification:", pushError);
    }

    return {
      success: true,
      message: "Withdrawal request rejected successfully",
      transaction: updatedTransaction,
    };
  }
}
