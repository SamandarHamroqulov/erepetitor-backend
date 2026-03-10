const cron = require("node-cron");
const prisma = require("../services/prismaClient");
const { sendDebtRemindersForMonth } = require("../services/reminders.service");

function getMonthYYYYMM(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function isLastDayOfMonth(d = new Date()) {
  const next = new Date(d);
  next.setDate(d.getDate() + 1);
  return next.getMonth() !== d.getMonth();
}

function startMonthlyReminderCron(bot) {
  // har kuni 09:00 da (UZT)
  cron.schedule("0 9 * * *", async () => {
    try {
      const now = new Date();
      const day = now.getDate();
      const month = getMonthYYYYMM(now);

      const shouldRun = day === 3 || day === 28 || isLastDayOfMonth(now);
      if (!shouldRun) return;

      // barcha teacherlar bo‘yicha yuborish (multi-tenant)
      const teachers = await prisma.teacher.findMany({ select: { id: true, isActive: true } });

      for (const t of teachers) {
        if (!t.isActive) continue;
        await sendDebtRemindersForMonth({ bot, teacherId: t.id, month });
      }

      console.log("✅ Monthly reminders sent for", month, "day", day);
    } catch (e) {
      console.error("[CRON MONTHLY REMINDERS]", e);
    }
  });
}

module.exports = { startMonthlyReminderCron };