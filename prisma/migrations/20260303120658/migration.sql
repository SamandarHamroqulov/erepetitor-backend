-- CreateTable
CREATE TABLE "TelegramLink" (
    "id" SERIAL NOT NULL,
    "teacherId" INTEGER NOT NULL,
    "phone" VARCHAR(32) NOT NULL,
    "chatId" VARCHAR(32) NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TelegramLink_chatId_idx" ON "TelegramLink"("chatId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramLink_teacherId_phone_key" ON "TelegramLink"("teacherId", "phone");

-- AddForeignKey
ALTER TABLE "TelegramLink" ADD CONSTRAINT "TelegramLink_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
