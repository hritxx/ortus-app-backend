import { Investment, Transaction } from "@prisma/client";

interface CompoundingResult {
  currentValue: number;
  returns: number;
  returnsPercentage: number;
}

export function calculateCompoundedValue(
  investment: Investment & { plan: { interestRate: number; type: string } },
  transactions: Transaction[],
  currentDate: Date = new Date()
): CompoundingResult {
  const interestRate = investment.plan.interestRate;
  const r = interestRate / 100;
  const rMonthly = r / 12;

  // Filter completed transactions that apply to this investment
  let completedTx = transactions.filter(
    (tx) => tx.status === "COMPLETED" && tx.investmentId === investment.id
  );

  // If no transactions are found, fallback to creating a virtual transaction for the initial investment amount
  if (completedTx.length === 0) {
    completedTx = [
      {
        id: "virtual-initial",
        userId: investment.userId,
        investmentId: investment.id,
        amount: investment.amountInvested,
        fee: 0,
        type: "INVESTMENT",
        status: "COMPLETED",
        paymentMethod: null,
        paymentReference: null,
        pgOrderId: null,
        pgPaymentId: null,
        pgSignature: null,
        pgProvider: null,
        razorpayOrderId: null,
        razorpayPaymentId: null,
        razorpaySignature: null,
        description: "Initial investment",
        metadata: null,
        createdAt: investment.createdAt,
        updatedAt: investment.createdAt,
        processedAt: investment.createdAt,
      },
    ];
  }

  // Sort transactions by date ascending
  const sortedTx = [...completedTx].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );

  const startDate = sortedTx[0].createdAt;
  
  // Calculate total elapsed months between start date and current date
  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const totalElapsedMonths = Math.max(
    0,
    (currentYear - startYear) * 12 + (currentMonth - startMonth)
  );

  let principal = 0;

  // We simulate month-by-month
  for (let m = 0; m <= totalElapsedMonths; m++) {
    // Determine the calendar window for month `m` relative to startDate
    const currentSimDateStart = new Date(startDate);
    currentSimDateStart.setMonth(startDate.getMonth() + m);
    
    const nextSimDateStart = new Date(startDate);
    nextSimDateStart.setMonth(startDate.getMonth() + m + 1);

    // Find and process transactions that fall within this month's window
    const monthTx = sortedTx.filter(
      (tx) =>
        tx.createdAt.getTime() >= currentSimDateStart.getTime() &&
        tx.createdAt.getTime() < nextSimDateStart.getTime()
    );

    for (const tx of monthTx) {
      if (tx.type === "INVESTMENT" || tx.type === "SIP_PAYMENT") {
        principal += tx.amount;
      } else if (tx.type === "WITHDRAWAL") {
        principal -= tx.amount;
        // Ensure balance doesn't go negative
        if (principal < 0) {
          principal = 0;
        }
      }
    }

    // Accrue and compound interest monthly
    principal = principal * (1 + rMonthly);
  }

  const currentValue = Math.max(0, principal);
  const totalDeposits = completedTx
    .filter((tx) => tx.type === "INVESTMENT" || tx.type === "SIP_PAYMENT")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const totalWithdrawals = completedTx
    .filter((tx) => tx.type === "WITHDRAWAL")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const netInvested = Math.max(0, totalDeposits - totalWithdrawals);

  const returns = currentValue - netInvested;
  const returnsPercentage = netInvested > 0 ? (returns / netInvested) * 100 : 0;

  return {
    currentValue: Number(currentValue.toFixed(2)),
    returns: Number(returns.toFixed(2)),
    returnsPercentage: Number(returnsPercentage.toFixed(2)),
  };
}
