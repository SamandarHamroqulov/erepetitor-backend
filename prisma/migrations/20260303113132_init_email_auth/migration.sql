/*
  Warnings:

  - You are about to drop the column `reviewedBy` on the `BillingPayment` table. All the data in the column will be lost.
  - You are about to drop the column `days` on the `Group` table. All the data in the column will be lost.
  - You are about to drop the column `time` on the `Group` table. All the data in the column will be lost.
  - You are about to drop the column `phoneNumber` on the `OtpCode` table. All the data in the column will be lost.
  - You are about to alter the column `month` on the `Payment` table. The data in that column could be lost. The data in that column will be cast from `VarChar(10)` to `VarChar(7)`.
  - The `status` column on the `Payment` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `isActive` on the `Student` table. All the data in the column will be lost.
  - You are about to drop the column `phoneNumber` on the `Teacher` table. All the data in the column will be lost.
  - You are about to drop the `SmsLog` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[email]` on the table `Teacher` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `email` to the `OtpCode` table without a default value. This is not possible if the table is not empty.
  - Added the required column `email` to the `Teacher` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Teacher` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "OtpPurpose" ADD VALUE 'LOGIN';

-- DropForeignKey
ALTER TABLE "SmsLog" DROP CONSTRAINT "SmsLog_teacherId_fkey";

-- DropIndex
DROP INDEX "OtpCode_phoneNumber_purpose_idx";

-- DropIndex
DROP INDEX "Teacher_phoneNumber_key";

-- AlterTable
ALTER TABLE "BillingPayment" DROP COLUMN "reviewedBy",
ADD COLUMN     "reviewedByAdminId" INTEGER;

-- AlterTable
ALTER TABLE "Group" DROP COLUMN "days",
DROP COLUMN "time";

-- AlterTable
ALTER TABLE "OtpCode" DROP COLUMN "phoneNumber",
ADD COLUMN     "email" VARCHAR(255) NOT NULL,
ADD COLUMN     "usedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "month" SET DATA TYPE VARCHAR(7),
DROP COLUMN "status",
ADD COLUMN     "status" "PaymentStatus" NOT NULL DEFAULT 'DUE';

-- AlterTable
ALTER TABLE "Student" DROP COLUMN "isActive",
ADD COLUMN     "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "Teacher" DROP COLUMN "phoneNumber",
ADD COLUMN     "email" VARCHAR(255) NOT NULL,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- DropTable
DROP TABLE "SmsLog";

-- DropEnum
DROP TYPE "SmsStatus";

-- CreateTable
CREATE TABLE "Admin" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "passwordHash" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE INDEX "Group_teacherId_idx" ON "Group"("teacherId");

-- CreateIndex
CREATE INDEX "OtpCode_email_purpose_idx" ON "OtpCode"("email", "purpose");

-- CreateIndex
CREATE INDEX "OtpCode_expiresAt_idx" ON "OtpCode"("expiresAt");

-- CreateIndex
CREATE INDEX "Payment_month_status_idx" ON "Payment"("month", "status");

-- CreateIndex
CREATE INDEX "Student_groupId_idx" ON "Student"("groupId");

-- CreateIndex
CREATE INDEX "Student_status_idx" ON "Student"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_email_key" ON "Teacher"("email");

-- AddForeignKey
ALTER TABLE "BillingPayment" ADD CONSTRAINT "BillingPayment_reviewedByAdminId_fkey" FOREIGN KEY ("reviewedByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
