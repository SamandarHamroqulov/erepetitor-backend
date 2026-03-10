const { Telegraf, Markup } = require("telegraf");
const prisma = require("./prismaClient");
const { normalizeUzPhone } = require("../utils/phone");

function createTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn("⚠️ TELEGRAM_BOT_TOKEN yo‘q. Telegram bot ishga tushmaydi.");
    return null;
  }

  const bot = new Telegraf(token);

  bot.start(async (ctx) => {
    return ctx.reply(
      "Assalomu alaykum!\n\nQuyidagilardan birini tanlang 👇",
      Markup.keyboard([
        [Markup.button.contactRequest("📱 Telefon raqamni ulashish")],
        ["👨‍🏫 O‘qituvchi paneli"],
      ]).resize().oneTime()
    );
  });

bot.hears("👨‍🏫 O‘qituvchi paneli", async (ctx) => {
  return ctx.reply(
    "O‘qituvchi paneliga kirish uchun tugmani bosing 👇",
    Markup.inlineKeyboard([
      Markup.button.webApp(
        "👨‍🏫 Panelni ochish",
        "http://192.168.91.132:5173"
      ),
    ])
  );
});

  bot.on("contact", async (ctx) => {
    try {
      const contact = ctx.message?.contact;
      const chatId = String(ctx.chat.id);

      if (!contact || contact.user_id !== ctx.from.id) {
        return ctx.reply("Iltimos, o‘zingizning telefon raqamingizni ulashing.");
      }

      const phone = normalizeUzPhone(contact.phone_number);
      if (!phone) {
        return ctx.reply("Telefon formatini tushunmadim. Qayta urinib ko‘ring.");
      }

      const student = await prisma.student.findFirst({
        where: {
          parentPhone: phone,
          isDeleted: false,
          groupId: { not: null },
        },
        select: {
          id: true,
          group: {
            select: {
              teacherId: true,
            },
          },
        },
      });

      if (!student || !student.group) {
        return ctx.reply(
          "Bu telefon raqam tizimdan topilmadi yoki faol guruhga ulanmagan.\nAdmin/ustoz tekshirib ko‘rsin."
        );
      }

      const teacherId = student.group.teacherId;

      await prisma.telegramLink.upsert({
        where: {
          teacherId_phone: {
            teacherId,
            phone,
          },
        },
        update: {
          chatId,
          linkedAt: new Date(),
        },
        create: {
          teacherId,
          phone,
          chatId,
        },
      });

      return ctx.reply(
        "✅ Telegram ulandi! Endi qarzdorlik va eslatmalar shu yerga keladi."
      );
    } catch (e) {
      console.error("[TG CONTACT]", e);
      return ctx.reply("Server xatoligi. Keyinroq urinib ko‘ring.");
    }
  });

  bot.command("stop", async (ctx) => {
    return ctx.reply("Tushunarli. Agar ulanishni bekor qilish kerak bo‘lsa admin bilan bog‘laning.");
  });

  return bot;
}

async function sendTelegramMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN yo‘q");
  throw new Error("sendTelegramMessage: bot instance kerak.");
}

module.exports = { createTelegramBot };