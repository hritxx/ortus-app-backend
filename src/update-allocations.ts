import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const planId = "cmged3fsd000411oeamkxngoz";
  console.log("Updating allocations for plan:", planId);

  const updatedPlan = await prisma.investmentPlan.update({
    where: { id: planId },
    data: {
      equityAllocation: 0,
      debtAllocation: 0,
      goldAllocation: 80,
      cashAllocation: 20,
    }
  });

  console.log("Updated Plan Allocations:", {
    name: updatedPlan.name,
    equity: updatedPlan.equityAllocation,
    debt: updatedPlan.debtAllocation,
    gold: updatedPlan.goldAllocation,
    cash: updatedPlan.cashAllocation,
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
