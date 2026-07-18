-- CreateEnum
CREATE TYPE "MfOrderSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "MandateType" AS ENUM ('ENACH', 'UPI_AUTOPAY', 'NACH', 'XSIP', 'ISIP');

-- CreateEnum
CREATE TYPE "MandateStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "MfOrderStatus" ADD VALUE 'REDEEMED';

-- AlterTable
ALTER TABLE "mutual_fund_orders" ADD COLUMN     "allUnits" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bankTxnRef" TEXT,
ADD COLUMN     "memOrdRefId" TEXT,
ADD COLUMN     "paymentRefId" TEXT,
ADD COLUMN     "side" "MfOrderSide" NOT NULL DEFAULT 'BUY',
ALTER COLUMN "amount" DROP NOT NULL;

-- Backfill memOrdRefId for existing rows before enforcing NOT NULL + UNIQUE.
UPDATE "mutual_fund_orders" SET "memOrdRefId" = "id" WHERE "memOrdRefId" IS NULL;
ALTER TABLE "mutual_fund_orders" ALTER COLUMN "memOrdRefId" SET NOT NULL;

-- CreateTable
CREATE TABLE "mf_holdings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ucc" TEXT NOT NULL,
    "schemeCode" TEXT NOT NULL,
    "schemeName" TEXT NOT NULL,
    "folioNumber" TEXT NOT NULL,
    "units" DOUBLE PRECISION NOT NULL,
    "avgCost" DOUBLE PRECISION,
    "lastNav" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mf_holdings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_mandates" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bseMandateId" TEXT,
    "type" "MandateType" NOT NULL,
    "amountLimit" DOUBLE PRECISION NOT NULL,
    "status" "MandateStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_mandates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sip_registrations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bseRegNo" TEXT,
    "schemeCode" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "frequency" TEXT NOT NULL,
    "mandateId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "nextDebit" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sip_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mf_holdings_userId_idx" ON "mf_holdings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "mf_holdings_ucc_schemeCode_folioNumber_key" ON "mf_holdings"("ucc", "schemeCode", "folioNumber");

-- CreateIndex
CREATE UNIQUE INDEX "bank_mandates_bseMandateId_key" ON "bank_mandates"("bseMandateId");

-- CreateIndex
CREATE INDEX "bank_mandates_userId_idx" ON "bank_mandates"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "sip_registrations_bseRegNo_key" ON "sip_registrations"("bseRegNo");

-- CreateIndex
CREATE INDEX "sip_registrations_userId_idx" ON "sip_registrations"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "mutual_fund_orders_memOrdRefId_key" ON "mutual_fund_orders"("memOrdRefId");

-- AddForeignKey
ALTER TABLE "mf_holdings" ADD CONSTRAINT "mf_holdings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_mandates" ADD CONSTRAINT "bank_mandates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sip_registrations" ADD CONSTRAINT "sip_registrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

