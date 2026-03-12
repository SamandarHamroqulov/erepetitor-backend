/*
  Warnings:

  - The values [LOGIN] on the enum `OtpPurpose` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `proofMime` on the `BillingPayment` table. All the data in the column will be lost.
  - You are about to drop the column `reviewedAt` on the `BillingPayment` table. All the data in the column will be lost.
  - You are about to drop the column `reviewedByAdminId` on the `BillingPayment` table. All the data in the column will be lost.
  - You are about to drop the column `usedAt` on the `OtpCode` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the `Admin` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "OtpPurpose_new" AS ENUM ('REGISTER', 'RESET_PASSWORD');
ALTER TABLE "OtpCode" ALTER COLUMN "purpose" TYPE "OtpPurpose_new" USING ("purpose"::text::"OtpPurpose_new");
ALTER TYPE "OtpPurpose" RENAME TO "OtpPurpose_old";
ALTER TYPE "OtpPurpose_new" RENAME TO "OtpPurpose";
DROP TYPE "public"."OtpPurpose_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "BillingPayment" DROP CONSTRAINT "BillingPayment_reviewedByAdminId_fkey";

-- DropIndex
DROP INDEX "Student_status_idx";

-- AlterTable
ALTER TABLE "BillingPayment" DROP COLUMN "proofMime",
DROP COLUMN "reviewedAt",
DROP COLUMN "reviewedByAdminId";

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "days" TEXT[],
ADD COLUMN     "time" TEXT;

-- AlterTable
ALTER TABLE "OtpCode" DROP COLUMN "usedAt";

-- AlterTable
ALTER TABLE "Student" DROP COLUMN "status",
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- DropTable
DROP TABLE "Admin";

-- DropEnum
DROP TYPE "StudentStatus";

-- CreateIndex
CREATE INDEX "BillingPayment_teacherId_idx" ON "BillingPayment"("teacherId");

-- CreateIndex
CREATE INDEX "BillingPayment_status_idx" ON "BillingPayment"("status");

-- CreateIndex
CREATE INDEX "Student_isActive_idx" ON "Student"("isActive");
