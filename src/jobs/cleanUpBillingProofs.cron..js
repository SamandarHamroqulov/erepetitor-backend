const cron = require("node-cron");
const path = require("path");
const fs = require("fs");
const prisma = require("../services/prismaClient");

function startBillingProofCleanupCron() {
  // har kuni 03:00 da ishlaydi
  cron.schedule("0 3 * * *", async () => {
    try {
      console.log("[CRON] Billing proof cleanup started");

      const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

      const items = await prisma.billingPayment.findMany({
        where: {
          status: "CONFIRMED",
          confirmedAt: { lte: cutoff },
          proofUrl: { not: null },
        },
        select: {
          id: true,
          proofUrl: true,
        },
      });

      for (const item of items) {
        try {
          if (
            item.proofUrl &&
            typeof item.proofUrl === "string" &&
            item.proofUrl.startsWith("/uploads/")
          ) {
            const absPath = path.join(process.cwd(), item.proofUrl.replace(/^\//, ""));
            if (fs.existsSync(absPath)) {
              fs.unlinkSync(absPath);
            }
          }

          await prisma.billingPayment.update({
            where: { id: item.id },
            data: { proofUrl: null },
          });
        } catch (fileErr) {
          console.error(`[CRON] Proof delete error for billingPayment ${item.id}`, fileErr);
        }
      }

      console.log(`[CRON] Billing proof cleanup finished. Cleaned: ${items.length}`);
    } catch (err) {
      console.error("[CRON] Billing proof cleanup failed", err);
    }
  });
}

module.exports = { startBillingProofCleanupCron };