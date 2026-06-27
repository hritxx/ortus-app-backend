import { PrismaClient } from "@prisma/client";
import { calculateCompoundedValue } from "./modules/investment/compounding";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: "royhriteek7@gmail.com" }
  });
  if (!user) {
    console.log("User not found!");
    return;
  }
  const userId = user.id;

  const investments = await prisma.investment.findMany({
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

  if (totalAllocatedValue === 0 && updatedInvestments.length > 0) {
    assetAllocation.equity = 40;
    assetAllocation.debt = 30;
    assetAllocation.gold = 15;
    assetAllocation.cash = 15;
  }

  console.log("RESULT PORTFOLIO:", JSON.stringify({
    totalInvested,
    currentValue,
    totalReturns,
    returnsPercentage,
    assetAllocation
  }, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
