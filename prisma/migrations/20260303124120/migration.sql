-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIAL';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "paidAmount" DECIMAL(65,30) NOT NULL DEFAULT 0;
