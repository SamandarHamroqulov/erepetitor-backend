/*
  Warnings:

  - You are about to drop the column `phone` on the `OtpCode` table. All the data in the column will be lost.
  - Added the required column `phoneNumber` to the `OtpCode` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "OtpCode_phone_purpose_idx";

-- AlterTable
ALTER TABLE "OtpCode" DROP COLUMN "phone",
ADD COLUMN     "phoneNumber" VARCHAR(20) NOT NULL;

-- CreateIndex
CREATE INDEX "OtpCode_phoneNumber_purpose_idx" ON "OtpCode"("phoneNumber", "purpose");
