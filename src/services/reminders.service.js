const prisma = require("./prismaClient");

async function sendDebtRemindersForMonth({ bot, teacherId, month }) {
  const dues = await prisma.payment.findMany({
    where: {
      month,
      status: "DUE",
      student: { group: { teacherId }, isActive: true },
    },
    include: {
      student: { select: { name: true, parentPhone: true, group: { select: { name: true } } } },
    },
  });

  for (const p of dues) {
    const phone = p.student.parentPhone;
    if (!phone) continue;

    const link = await prisma.telegramLink.findUnique({
      where: { teacherId_phone: { teacherId, phone } },
      select: { chatId: true },
    });
    if (!link) continue;

    const text =
      `📌 To‘lov eslatmasi\n` +
      `Guruh: ${p.student.group.name}\n` +
      `O‘quvchi: ${p.student.name}\n` +
      `Oy: ${p.month}\n` +
      `Qarzdorlik: ${String(p.amount)}\n\n` +
      `✅ To‘lov qilingach, admin/ustozga chek yuboring.`;

    try {
      await bot.telegram.sendMessage(link.chatId, text);
    } catch (e) {
      console.error("[TG SEND FAIL]", link.chatId, e?.message || e);
    }
  }
}

module.exports = { sendDebtRemindersForMonth };