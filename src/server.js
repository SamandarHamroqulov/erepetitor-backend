require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const mainRouter = require("./routes/main.routes");
const { createTelegramBot } = require("./services/telegram.service");
const { startMonthlyReminderCron } = require("./jobs/monthlyReminders.cron");
const { startBillingProofCleanupCron } = require("./jobs/cleanUpBillingProofs.cron.");
const app = express();
app.set("trust proxy", 1);
// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("CORS ruxsat bermadi: " + origin));
    },
    credentials: true,
  })
);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cookieParser());
app.use(express.json());

// ── Static uploads ────────────────────────────────────────────────────────────
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// ── API ───────────────────────────────────────────────────────────────────────
app.use("/api", mainRouter);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: "Route topilmadi" });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("[SERVER ERROR]", err);
  res.status(500).json({ message: err?.message || "Server xatoligi" });
});

const PORT = process.env.PORT || 4000;

let bot = null;
let cronStarted = false;

const server = app.listen(PORT, "0.0.0.0", async () => {
  console.log(`✅ Server running on port ${PORT}`);

  
  try {
    bot = createTelegramBot();

    if (!bot) {
      console.log("⚠️ Telegram bot yaratilmadi");
    } else {
      app.set("telegramBot", bot);
      await bot.launch();
      console.log("✅ Telegram bot launched");
    }

    if (!cronStarted) {
      if (bot) {
        startMonthlyReminderCron(bot);
        console.log("✅ Reminder cron started");
      }

      startBillingProofCleanupCron();
      console.log("✅ Billing proof cleanup cron started");

      cronStarted = true;
    }
  } catch (err) {
    console.error("❌ Telegram bot error:", err?.message || err);
    console.log("⚠️ Server botsiz ishlashda davom etadi");

    if (!cronStarted) {
      startBillingProofCleanupCron();
      console.log("✅ Billing proof cleanup cron started");
      cronStarted = true;
    }
  }
});

process.once("SIGINT", async () => {
  try {
    if (bot) await bot.stop("SIGINT");
  } catch (e) {
    console.error("Bot stop error:", e?.message || e);
  }
  server.close(() => process.exit(0));
});

process.once("SIGTERM", async () => {
  try {
    if (bot) await bot.stop("SIGTERM");
  } catch (e) {
    console.error("Bot stop error:", e?.message || e);
  }
  server.close(() => process.exit(0));
});