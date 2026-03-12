const path = require("path");
const fs = require("fs");
const prisma = require("../services/prismaClient");
const { get } = require("http");

const MONTHLY_PRICE = Number(process.env.BILLING_MONTHLY_PRICE || 0);
const MAX_FILE_SIZE = 6 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const DAYS_PER_MONTH = 30;

// ── Helpers ──────────────────────────────────────────────────────────────────

function calcMinAmount(months) {
  const m = Number(months || 1);
  if (!Number.isFinite(m) || m < 1 || !MONTHLY_PRICE) return 0;
  return MONTHLY_PRICE * m;
}

function requireAdmin(req, res) {
  // Role-based: user with ADMIN role can access
  if (req.user?.role === "ADMIN") return true;
  // Fallback: x-admin-token header (for API clients, backward compatibility)
  const token = req.headers["x-admin-token"];
  if (process.env.ADMIN_TOKEN && token === process.env.ADMIN_TOKEN) return true;
  res.status(403).json({ message: "Admin huquqi yo'q" });
  return false;
}

function maskCard(n) {
  const s = String(n || "").replace(/\s+/g, "");
  if (s.length < 8) return s || "—";
  return `${s.slice(0, 4)} **** **** ${s.slice(-4)}`;
}

// Foydalanuvchiga ko'rsatiladigan to'lov ma'lumotlari
function getPayInfoPublic() {
  return {
    cardOwner:      process.env.BILLING_CARD_OWNER || "—",
    cardNumber:     maskCard(process.env.BILLING_CARD_NUMBER),
    cardNumberFull: process.env.BILLING_CARD_NUMBER || "—",
    bankName:       process.env.BILLING_BANK_NAME || "—",
  };
}

// faqat admin ko‘rsa kerak bo‘lsa
function getPayInfoAdmin() {
  return {
    cardOwner:      process.env.BILLING_CARD_OWNER || "—",
    cardNumber:     maskCard(process.env.BILLING_CARD_NUMBER),
    cardNumberFull: process.env.BILLING_CARD_NUMBER || "—",
    bankName:       process.env.BILLING_BANK_NAME || "—",
  };
}

function ensureUploadsDir() {
  const dir = path.join(process.cwd(), "uploads", "billing");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function buildProofUrl(filename) {
  const base = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
  return base ? `${base}/uploads/billing/${filename}` : `/uploads/billing/${filename}`;
}

// ── ME ────────────────────────────────────────────────────────────────────────
// GET /api/billing/me
exports.ME = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const sub = await prisma.subscription.findUnique({ where: { teacherId } });

    return res.json({
      subscription: sub || null,
      pricing: { monthlyPrice: MONTHLY_PRICE, currency: "UZS" },
      payInfo: getPayInfoPublic(),
    });
  } catch (e) {
    console.error("[BILLING ME]", e);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

// ── MY PAYMENTS ───────────────────────────────────────────────────────────────
// GET /api/billing/my-payments
exports.MY_PAYMENTS = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const payments = await prisma.billingPayment.findMany({
      where: { teacherId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true, amount: true, months: true, status: true,
        proofUrl: true, note: true, rejectReason: true,
        createdAt: true, confirmedAt: true,
      },
    });
    return res.json({ payments });
  } catch (e) {
    console.error("[BILLING MY_PAYMENTS]", e);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

// ── CREATE ────────────────────────────────────────────────────────────────────
// POST /api/billing/create
exports.CREATE = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const months = Number(req.body.months ?? 1);
    const amount = Number(req.body.amount ?? 0);

    if (!Number.isFinite(months) || months < 1 || months > 12) {
      return res.status(400).json({ message: "months 1..12 bo'lishi kerak" });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: "amount noto'g'ri" });
    }

    const minAmount = calcMinAmount(months);
    if (minAmount > 0 && amount < minAmount) {
      return res.status(400).json({
        code: "AMOUNT_TOO_LOW",
        message: `Minimal to'lov: ${minAmount.toLocaleString()} UZS`,
        minAmount,
        monthlyPrice: MONTHLY_PRICE,
        months,
      });
    }

    const pending = await prisma.billingPayment.findFirst({
      where: { teacherId, status: "PENDING" },
      select: { id: true },
    });
    if (pending) {
      return res.status(400).json({
        code: "PENDING_EXISTS",
        message: "Ko'rib chiqilmagan to'lovingiz mavjud. Avvalgisi tasdiqlangunicha kuting.",
        paymentId: pending.id,
      });
    }

    const payment = await prisma.billingPayment.create({
      data: { teacherId, amount, months, status: "PENDING" },
    });

    return res.status(201).json({
      payment,
      minAmount,
      pricing: { monthlyPrice: MONTHLY_PRICE, currency: "UZS" },
      payInfo: getPayInfoPublic(),
      instruction: "Karta raqamiga to'lov qiling, so'ng chek rasmini yuklang.",
    });
  } catch (e) {
    console.error("[BILLING CREATE]", e);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

// ── ADD PROOF ─────────────────────────────────────────────────────────────────
// POST /api/billing/:id/proof
exports.ADD_PROOF = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const id = Number(req.params.id);
    const note = req.body?.note ? String(req.body.note).trim().slice(0, 500) : null;

    if (!Number.isFinite(id)) return res.status(400).json({ message: "ID noto'g'ri" });

    const payment = await prisma.billingPayment.findFirst({ where: { id, teacherId } });
    if (!payment) return res.status(404).json({ message: "To'lov topilmadi" });
    if (payment.status !== "PENDING") {
      return res.status(400).json({ message: "Bu to'lov allaqachon ko'rib chiqilgan" });
    }

    // express-fileupload -> req.files (field: "file")
    if (!req.files || !req.files.file) {
      return res.status(400).json({ message: "Fayl yuklanmadi ('file' key bilan FormData)" });
    }

    const proofFile = req.files.file;

    const allowedMime = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedMime.includes(proofFile.mimetype)) {
      return res.status(400).json({ message: "Faqat JPG, PNG yoki WEBP o'z ichiga olsin" });
    }

    if (proofFile.size > 2 * 1024 * 1024) {
      return res.status(400).json({ message: "Fayl hajmi 2MB dan katta bo'lmasin" });
    }

    const dir = ensureUploadsDir();

    const ext = path.extname(proofFile.name || ".jpg").toLowerCase() || ".jpg";
    const filename = `bill_${id}_${Date.now()}${ext}`;
    const uploadPath = path.join(dir, filename);

    // Eski faylni o'chirish
    if (payment.proofUrl) {
      try {
        const old = path.join(process.cwd(), payment.proofUrl);
        if (fs.existsSync(old)) fs.unlinkSync(old);
      } catch (_) {}
    }

    await proofFile.mv(uploadPath);

    const updated = await prisma.billingPayment.update({
      where: { id },
      data: { proofUrl: `/uploads/billing/${filename}`, ...(note && { note }) },
    });

    return res.json({ message: "Chek saqlandi", payment: updated });
  } catch (e) {
    console.error("[BILLING ADD_PROOF]", e);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

// ── CONFIRM (Admin) ───────────────────────────────────────────────────────────
// POST /api/billing/:id/confirm
exports.CONFIRM = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "ID noto'g'ri" });

    const payment = await prisma.billingPayment.findUnique({
      where: { id },
      select: { id: true, teacherId: true, months: true, amount: true, status: true, proofUrl: true },
    });

    if (!payment) return res.status(404).json({ message: "To'lov topilmadi" });
    if (payment.status !== "PENDING") return res.status(400).json({ message: "To'lov PENDING emas" });
    if (!payment.proofUrl) return res.status(400).json({ message: "Chek rasmi yuklanmagan" });

    const minAmount = calcMinAmount(payment.months);
    if (minAmount > 0 && Number(payment.amount) < minAmount) {
      return res.status(400).json({
        code: "AMOUNT_TOO_LOW",
        message: `Summa minimaldan past. Minimal: ${minAmount.toLocaleString()} UZS`,
        minAmount,
      });
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.billingPayment.update({
        where: { id },
        data: { status: "CONFIRMED", confirmedAt: now },
      });

      const sub = await tx.subscription.findUnique({
        where: { teacherId: payment.teacherId },
        select: { currentPeriodEndsAt: true },
      });

      const base =
        sub?.currentPeriodEndsAt && new Date(sub.currentPeriodEndsAt) > now
          ? new Date(sub.currentPeriodEndsAt)
          : now;

      const extended = new Date(base.getTime() + payment.months * DAYS_PER_MONTH * 24 * 60 * 60 * 1000);

      await tx.subscription.upsert({
        where: { teacherId: payment.teacherId },
        update: { status: "ACTIVE", currentPeriodEndsAt: extended },
        create: {
          teacherId: payment.teacherId,
          status: "ACTIVE",
          trialEndsAt: null,
          currentPeriodEndsAt: extended,
        },
      });
    });

    return res.json({ message: "Tasdiqlandi, obuna uzaytirildi" });
  } catch (e) {
    console.error("[BILLING CONFIRM]", e);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

// ── REJECT (Admin) ────────────────────────────────────────────────────────────
// POST /api/billing/:id/reject
exports.REJECT = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "ID noto'g'ri" });

    const rejectReason = req.body?.rejectReason
      ? String(req.body.rejectReason).trim().slice(0, 500)
      : null;

    const payment = await prisma.billingPayment.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!payment) return res.status(404).json({ message: "To'lov topilmadi" });
    if (payment.status !== "PENDING") return res.status(400).json({ message: "To'lov PENDING emas" });

    await prisma.billingPayment.update({
      where: { id },
      data: { status: "REJECTED", ...(rejectReason && { rejectReason }) },
    });

    return res.json({ message: "To'lov rad etildi" });
  } catch (e) {
    console.error("[BILLING REJECT]", e);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

// ── ADMIN PENDING ─────────────────────────────────────────────────────────────
// GET /api/billing/admin/pending
exports.ADMIN_PENDING = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const page  = Math.max(1, Number(req.query.page  || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
    const skip  = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.billingPayment.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        skip,
        take: limit,
        select: {
          id: true, teacherId: true, amount: true, months: true,
          status: true, proofUrl: true, note: true, createdAt: true,
          teacher: { select: { name: true, email: true } },
        },
      }),
      prisma.billingPayment.count({ where: { status: "PENDING" } }),
    ]);

    return res.json({
      items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (e) {
    console.error("[BILLING ADMIN_PENDING]", e);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

// ── ADMIN ALL ──────────────────────────────────────────────────────────────────
// GET /api/billing/admin/all?status=PENDING&page=1
exports.ADMIN_ALL = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;

    const page   = Math.max(1, Number(req.query.page  || 1));
    const limit  = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
    const skip   = (page - 1) * limit;
    const status = req.query.status || undefined;
    const where  = status ? { status } : {};

    const [items, total] = await Promise.all([
      prisma.billingPayment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true, teacherId: true, amount: true, months: true,
          status: true, proofUrl: true, note: true, rejectReason: true,
          createdAt: true, confirmedAt: true,
          teacher: { select: { name: true, email: true } },
        },
      }),
      prisma.billingPayment.count({ where }),
    ]);

    return res.json({
      items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (e) {
    console.error("[BILLING ADMIN_ALL]", e);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};
