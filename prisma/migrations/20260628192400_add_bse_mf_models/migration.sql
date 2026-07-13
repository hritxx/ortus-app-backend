-- CreateEnum
CREATE TYPE "MfOrderType" AS ENUM ('LUMPSUM', 'SIP');

-- CreateEnum
CREATE TYPE "MfOrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'PROCESSING', 'ALLOTTED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "bseUcc" TEXT,
ADD COLUMN     "fatcaRegistered" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "mutual_fund_orders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bseOrderNumber" TEXT,
    "schemeCode" TEXT NOT NULL,
    "schemeName" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" "MfOrderType" NOT NULL DEFAULT 'LUMPSUM',
    "status" "MfOrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "paymentUrl" TEXT,
    "folioNumber" TEXT,
    "units" DOUBLE PRECISION,
    "bseRemarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mutual_fund_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mf_schemes" (
    "id" TEXT NOT NULL,
    "schemeCode" TEXT NOT NULL,
    "schemeName" TEXT NOT NULL,
    "amcName" TEXT,
    "category" TEXT,
    "isin" TEXT,
    "minPurchase" DOUBLE PRECISION,
    "sipAllowed" BOOLEAN NOT NULL DEFAULT false,
    "nav" DOUBLE PRECISION,
    "navDate" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mf_schemes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mutual_fund_orders_bseOrderNumber_key" ON "mutual_fund_orders"("bseOrderNumber");

-- CreateIndex
CREATE INDEX "mutual_fund_orders_userId_idx" ON "mutual_fund_orders"("userId");

-- CreateIndex
CREATE INDEX "mutual_fund_orders_status_idx" ON "mutual_fund_orders"("status");

-- CreateIndex
CREATE UNIQUE INDEX "mf_schemes_schemeCode_key" ON "mf_schemes"("schemeCode");

-- CreateIndex
CREATE INDEX "mf_schemes_category_idx" ON "mf_schemes"("category");

-- CreateIndex
CREATE UNIQUE INDEX "users_bseUcc_key" ON "users"("bseUcc");

-- AddForeignKey
ALTER TABLE "mutual_fund_orders" ADD CONSTRAINT "mutual_fund_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
