import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const plans = await prisma.investmentPlan.findMany({});
  console.log("ALL PLANS IN DB:");
  plans.forEach(p => {
    console.log(`- ${p.name} (${p.id}): Eq=${p.equityAllocation}, Debt=${p.debtAllocation}, Gold=${p.goldAllocation}, Cash=${p.cashAllocation}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
