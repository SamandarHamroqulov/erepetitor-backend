-- AlterTable
ALTER TABLE "BillingPayment" ADD COLUMN     "proofMime" TEXT,
ADD COLUMN     "rejectReason" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedBy" INTEGER;
