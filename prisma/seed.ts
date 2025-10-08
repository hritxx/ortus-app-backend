import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");

  // Clear existing data (in reverse order of dependencies)
  await prisma.tokenTransaction.deleteMany();
  await prisma.portfolioSnapshot.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.otpVerification.deleteMany();
  await prisma.device.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.investment.deleteMany();
  await prisma.investmentPlan.deleteMany();
  await prisma.user.deleteMany();

  console.log("✅ Cleared existing data");

  // Create test users
  const hashedPassword = await bcrypt.hash("Test@123", 12);

  const user1 = await prisma.user.create({
    data: {
      email: "demo@ortusfinance.com",
      password: hashedPassword,
      name: "Demo User",
      phone: "+919876543210",
      panNumber: "ABCDE1234F",
      emailVerified: true,
      phoneVerified: true,
      tokenBalance: 150,
      kycStatus: "APPROVED",
      address: "123 Finance Street, Mumbai, Maharashtra 400001",
      bankAccount: "1234567890",
      ifscCode: "HDFC0001234",
      bankName: "HDFC Bank",
      accountHolder: "Demo User",
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: "investor@ortusfinance.com",
      password: hashedPassword,
      name: "Active Investor",
      phone: "+919876543211",
      panNumber: "FGHIJ5678K",
      emailVerified: true,
      phoneVerified: true,
      tokenBalance: 250,
      kycStatus: "APPROVED",
      address: "456 Investment Avenue, Bangalore, Karnataka 560001",
      bankAccount: "0987654321",
      ifscCode: "ICIC0004567",
      bankName: "ICICI Bank",
      accountHolder: "Active Investor",
    },
  });

  const user3 = await prisma.user.create({
    data: {
      email: "newuser@ortusfinance.com",
      password: hashedPassword,
      name: "New User",
      phone: "+919876543212",
      emailVerified: false,
      phoneVerified: false,
      tokenBalance: 0,
      kycStatus: "PENDING",
    },
  });

  console.log("✅ Created 3 test users");

  // Create investment plans
  const growthFund = await prisma.investmentPlan.create({
    data: {
      name: "Growth Fund",
      professionalTitle: "High Growth Equity Fund",
      type: "LUMP_SUM",
      interestRate: 12.5,
      minimumInvestment: 10000,
      maximumInvestment: 5000000,
      lockInPeriod: 36,
      description:
        "A high-growth equity fund focused on emerging market leaders and innovative companies with strong fundamentals.",
      benefits: [
        "Professional fund management",
        "Diversified portfolio",
        "Tax benefits under 80C",
        "Liquidity after lock-in",
        "Regular portfolio updates",
      ],
      riskLevel: "HIGH",
      fees: {
        managementFee: 1.5,
        exitFee: 1.0,
        entryLoad: 0,
      },
      fixedTokens: 100,
      minPeriodicTokens: 10,
      maxPeriodicTokens: 50,
      isActive: true,
    },
  });

  const sipPlan = await prisma.investmentPlan.create({
    data: {
      name: "Smart SIP",
      professionalTitle: "Systematic Investment Plan - Balanced",
      type: "SIP",
      interestRate: 10.5,
      minimumInvestment: 1000,
      maximumInvestment: 100000,
      lockInPeriod: 12,
      description:
        "A balanced SIP plan perfect for building wealth systematically with monthly investments. Ideal for long-term financial goals.",
      benefits: [
        "Start with ₹1000/month",
        "Rupee cost averaging",
        "Power of compounding",
        "Flexible investment amount",
        "Auto-debit facility",
      ],
      riskLevel: "MEDIUM",
      fees: {
        managementFee: 1.0,
        exitFee: 0.5,
        entryLoad: 0,
      },
      fixedTokens: 50,
      minPeriodicTokens: 5,
      maxPeriodicTokens: 25,
      isActive: true,
    },
  });

  const swpPlan = await prisma.investmentPlan.create({
    data: {
      name: "Premium SWP",
      professionalTitle: "Systematic Withdrawal Plan - Income",
      type: "SWP",
      interestRate: 8.5,
      minimumInvestment: 500000,
      maximumInvestment: 10000000,
      lockInPeriod: 6,
      description:
        "Generate regular income from your investments while keeping your capital invested and growing. Perfect for retirees.",
      benefits: [
        "Regular monthly income",
        "Capital appreciation",
        "Tax-efficient withdrawals",
        "Flexible withdrawal amount",
        "Emergency fund access",
      ],
      riskLevel: "LOW",
      fees: {
        managementFee: 0.75,
        exitFee: 0,
        entryLoad: 0,
      },
      fixedTokens: 200,
      minPeriodicTokens: 15,
      maxPeriodicTokens: 75,
      isActive: true,
    },
  });

  const debtFund = await prisma.investmentPlan.create({
    data: {
      name: "Stable Debt Fund",
      professionalTitle: "Corporate Debt & Government Securities",
      type: "LUMP_SUM",
      interestRate: 7.5,
      minimumInvestment: 25000,
      maximumInvestment: 2000000,
      lockInPeriod: 24,
      description:
        "Conservative debt fund investing in high-rated corporate bonds and government securities for stable returns.",
      benefits: [
        "Low risk investment",
        "Stable returns",
        "Better than FD",
        "High credit quality",
        "Quarterly dividends",
      ],
      riskLevel: "LOW",
      fees: {
        managementFee: 0.5,
        exitFee: 0.25,
        entryLoad: 0,
      },
      fixedTokens: 75,
      minPeriodicTokens: 8,
      maxPeriodicTokens: 30,
      isActive: true,
    },
  });

  const elssPlans = await prisma.investmentPlan.create({
    data: {
      name: "Tax Saver ELSS",
      professionalTitle: "Equity Linked Savings Scheme",
      type: "SIP",
      interestRate: 11.5,
      minimumInvestment: 500,
      maximumInvestment: 150000,
      lockInPeriod: 36,
      description:
        "Tax-saving mutual fund with 3-year lock-in. Invest up to ₹1.5L and save tax under Section 80C.",
      benefits: [
        "Tax deduction under 80C",
        "Shortest lock-in period",
        "Equity returns potential",
        "SIP option available",
        "Wealth creation + tax saving",
      ],
      riskLevel: "HIGH",
      fees: {
        managementFee: 1.25,
        exitFee: 0,
        entryLoad: 0,
      },
      fixedTokens: 80,
      minPeriodicTokens: 10,
      maxPeriodicTokens: 40,
      isActive: true,
    },
  });

  console.log("✅ Created 5 investment plans");

  // Create investments for user1
  const investment1 = await prisma.investment.create({
    data: {
      userId: user1.id,
      planId: growthFund.id,
      amountInvested: 50000,
      currentValue: 56250,
      returns: 6250,
      returnsPercentage: 12.5,
      maturityDate: new Date("2027-06-15"),
      status: "ACTIVE",
    },
  });

  const investment2 = await prisma.investment.create({
    data: {
      userId: user1.id,
      planId: sipPlan.id,
      amountInvested: 24000,
      currentValue: 26040,
      returns: 2040,
      returnsPercentage: 8.5,
      maturityDate: new Date("2026-01-15"),
      nextSipDate: new Date("2025-11-01"),
      sipAmount: 2000,
      status: "ACTIVE",
    },
  });

  // Create investments for user2
  const investment3 = await prisma.investment.create({
    data: {
      userId: user2.id,
      planId: swpPlan.id,
      amountInvested: 750000,
      currentValue: 798750,
      returns: 48750,
      returnsPercentage: 6.5,
      maturityDate: new Date("2026-03-01"),
      swpAmount: 15000,
      status: "ACTIVE",
    },
  });

  const investment4 = await prisma.investment.create({
    data: {
      userId: user2.id,
      planId: elssPlans.id,
      amountInvested: 36000,
      currentValue: 40320,
      returns: 4320,
      returnsPercentage: 12.0,
      maturityDate: new Date("2028-04-01"),
      nextSipDate: new Date("2025-11-01"),
      sipAmount: 3000,
      status: "ACTIVE",
    },
  });

  console.log("✅ Created 4 investments");

  // Create transactions
  await prisma.transaction.create({
    data: {
      userId: user1.id,
      investmentId: investment1.id,
      type: "INVESTMENT",
      amount: 50000,
      fee: 750,
      status: "COMPLETED",
      paymentMethod: "UPI",
      paymentReference: "TXN001234567890",
      razorpayOrderId: "order_test_001",
      razorpayPaymentId: "pay_test_001",
      description: "Initial investment in Growth Fund",
      processedAt: new Date("2024-06-15"),
    },
  });

  await prisma.transaction.create({
    data: {
      userId: user1.id,
      investmentId: investment2.id,
      type: "SIP_PAYMENT",
      amount: 2000,
      fee: 20,
      status: "COMPLETED",
      paymentMethod: "Auto Debit",
      paymentReference: "SIP202410",
      razorpayOrderId: "order_test_002",
      razorpayPaymentId: "pay_test_002",
      description: "SIP payment for October 2024",
      processedAt: new Date("2024-10-01"),
    },
  });

  await prisma.transaction.create({
    data: {
      userId: user2.id,
      investmentId: investment3.id,
      type: "INVESTMENT",
      amount: 750000,
      fee: 5625,
      status: "COMPLETED",
      paymentMethod: "Net Banking",
      paymentReference: "TXN009876543210",
      razorpayOrderId: "order_test_003",
      razorpayPaymentId: "pay_test_003",
      description: "Investment in Premium SWP",
      processedAt: new Date("2025-03-01"),
    },
  });

  console.log("✅ Created 3 transactions");

  // Create token transactions
  await prisma.tokenTransaction.create({
    data: {
      userId: user1.id,
      type: "INVESTMENT_SIGNUP",
      amount: 100,
      balance: 100,
      source: "investment_signup",
      description: "Tokens for Growth Fund investment",
      investmentId: investment1.id,
      planId: growthFund.id,
    },
  });

  await prisma.tokenTransaction.create({
    data: {
      userId: user1.id,
      type: "INVESTMENT_SIGNUP",
      amount: 50,
      balance: 150,
      source: "investment_signup",
      description: "Tokens for Smart SIP enrollment",
      investmentId: investment2.id,
      planId: sipPlan.id,
    },
  });

  await prisma.tokenTransaction.create({
    data: {
      userId: user2.id,
      type: "INVESTMENT_SIGNUP",
      amount: 200,
      balance: 200,
      source: "investment_signup",
      description: "Tokens for Premium SWP investment",
      investmentId: investment3.id,
      planId: swpPlan.id,
    },
  });

  await prisma.tokenTransaction.create({
    data: {
      userId: user2.id,
      type: "PERIODIC_PAYMENT",
      amount: 35,
      balance: 235,
      source: "periodic_payment",
      description: "Random tokens for SIP payment",
      investmentId: investment4.id,
      planId: elssPlans.id,
    },
  });

  await prisma.tokenTransaction.create({
    data: {
      userId: user2.id,
      type: "REFERRAL_BONUS",
      amount: 15,
      balance: 250,
      source: "referral",
      description: "Referral bonus tokens",
    },
  });

  console.log("✅ Created 5 token transactions");

  // Create notifications
  await prisma.notification.create({
    data: {
      userId: user1.id,
      title: "Welcome to Ortus Finance!",
      body: "Your account has been successfully created. Start your investment journey today!",
      type: "INFO",
      category: "SYSTEM",
      isRead: true,
      isPushSent: true,
      pushSentAt: new Date(),
    },
  });

  await prisma.notification.create({
    data: {
      userId: user1.id,
      title: "Investment Successful",
      body: "Your investment of ₹50,000 in Growth Fund has been confirmed. You earned 100 tokens!",
      type: "SUCCESS",
      category: "INVESTMENT",
      isRead: true,
    },
  });

  await prisma.notification.create({
    data: {
      userId: user1.id,
      title: "SIP Payment Due",
      body: "Your SIP payment of ₹2,000 is due on November 1st. Ensure sufficient balance.",
      type: "WARNING",
      category: "TRANSACTION",
      isRead: false,
    },
  });

  console.log("✅ Created 3 notifications");

  // Create portfolio snapshots
  await prisma.portfolioSnapshot.create({
    data: {
      userId: user1.id,
      totalInvested: 74000,
      currentValue: 82290,
      totalReturns: 8290,
      totalReturnsPercentage: 11.2,
      tokenBalance: 150,
      snapshotDate: new Date(),
    },
  });

  await prisma.portfolioSnapshot.create({
    data: {
      userId: user2.id,
      totalInvested: 786000,
      currentValue: 839070,
      totalReturns: 53070,
      totalReturnsPercentage: 6.75,
      tokenBalance: 250,
      snapshotDate: new Date(),
    },
  });

  console.log("✅ Created 2 portfolio snapshots");

  console.log("\n🎉 Database seeding completed successfully!");
  console.log("\n📊 Summary:");
  console.log(
    "- Users: 3 (demo@ortusfinance.com, investor@ortusfinance.com, newuser@ortusfinance.com)"
  );
  console.log("- Password for all: Test@123");
  console.log("- Investment Plans: 5");
  console.log("- Active Investments: 4");
  console.log("- Transactions: 3");
  console.log("- Token Transactions: 5");
  console.log("- Notifications: 3");
  console.log("- Portfolio Snapshots: 2\n");
}

main()
  .catch((e) => {
    console.error("❌ Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
