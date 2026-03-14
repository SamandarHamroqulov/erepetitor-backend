const prisma = require("../services/prismaClient");
const { sendDebtRemindersForMonth } = require("../services/reminders.service");

/**
 * POST /api/payments/notify-debtors
 * body: { month: "YYYY-MM" }  (optional, defaults to current month)
 * O'qituvchi o'zi bosib qarzdorlarga Telegram xabar yuboradi.
 */
exports.NOTIFY_DEBTORS = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const bot = req.app.get("telegramBot");

    if (!bot) {
      return res.status(503).json({
        message: "Telegram bot sozlanmagan. .env da TELEGRAM_BOT_TOKEN ni tekshiring.",
      });
    }

    // Month: body dan yoki joriy oy
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const month = req.body.month || defaultMonth;

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ message: "month formati noto'g'ri (YYYY-MM)" });
    }

    // Qarzdorlarni topamiz — Telegram linked ota-onalari bor
    const dues = await prisma.payment.findMany({
      where: {
        month: month,
        status: { in: ["DUE", "PARTIAL"] },
        student: {
          group: { teacherId },
          isActive: true,
          parentPhone: { not: null },
        },
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            parentPhone: true,
            group: { select: { name: true } },
          },
        },
      },
    });

    if (dues.length === 0) {
      return res.json({
        message: "Bu oy uchun qarzdor o'quvchi yo'q",
        sent: 0,
        noLink: 0,
        total: 0,
      });
    }

    // Har biri uchun TelegramLink borligini tekshiramiz
    const phones = dues
      .map((d) => d.student.parentPhone)
      .filter(Boolean);

    const links = await prisma.telegramLink.findMany({
      where: {
        teacherId,
        phone: { in: phones },
      },
      select: { phone: true, chatId: true },
    });

    const linkMap = new Map(links.map((l) => [l.phone, l.chatId]));

    let sent = 0;
    let noLink = 0;
    const sentTo = [];

    for (const p of dues) {
      const phone = p.student.parentPhone;
      const chatId = phone ? linkMap.get(phone) : null;

      if (!chatId) {
        noLink++;
        continue;
      }

      const remaining = Number(p.amount) - Number(p.paidAmount || 0);
      const monthLabel = p.month.slice(0, 7); // "YYYY-MM"

      const text =
        `📌 To'lov eslatmasi\n` +
        `━━━━━━━━━━━━━━━\n` +
        `👤 O'quvchi: ${p.student.name}\n` +
        `📚 Guruh: ${p.student.group?.name || "—"}\n` +
        `📅 Oy: ${monthLabel}\n` +
        `💰 Qoldiq: ${Number(remaining).toLocaleString("uz-UZ")} UZS\n` +
        `━━━━━━━━━━━━━━━\n` +
        `✅ To'lovni amalga oshirgach, ustoz/adminга chek yuboring.`;

      try {
        await bot.telegram.sendMessage(chatId, text);
        sent++;
        sentTo.push({ name: p.student.name, phone });
      } catch (e) {
        console.error("[TG NOTIFY DEBTOR]", p.student.name, e?.message || e);
        noLink++;
      }
    }

    return res.json({
      message: `${sent} ta ota-onaga xabar yuborildi`,
      sent,
      noLink,
      total: dues.length,
      sentTo,
    });
  } catch (err) {
    console.error("[NOTIFY DEBTORS]", err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};
