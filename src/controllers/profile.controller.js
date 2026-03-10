const prisma = require("../services/prismaClient");
const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs");

const SALT = 10;

// GET /api/profile/me
exports.ME = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { id: true, name: true, email: true, avatarUrl: true, role: true, createdAt: true },
    });
    return res.json({ teacher });
  } catch (e) {
    console.error("[PROFILE ME]", e);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

// PATCH /api/profile/me
exports.UPDATE_ME = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const { name } = req.body;

    const teacher = await prisma.teacher.update({
      where: { id: teacherId },
      data: { ...(name ? { name: String(name).trim() } : {}) },
      select: { id: true, name: true, email: true, avatarUrl: true, role: true },
    });

    return res.json({ teacher, message: "Profil yangilandi" });
  } catch (e) {
    console.error("[PROFILE UPDATE]", e);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

// POST /api/profile/change-password
exports.CHANGE_PASSWORD = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "currentPassword va newPassword kerak" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Yangi parol kamida 6 ta belgi bo'lsin" });
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { passwordHash: true },
    });
    if (!teacher?.passwordHash) {
      return res.status(400).json({ message: "Parol topilmadi" });
    }

    const ok = await bcrypt.compare(currentPassword, teacher.passwordHash);
    if (!ok) return res.status(400).json({ message: "Joriy parol noto'g'ri" });

    const passwordHash = await bcrypt.hash(newPassword, SALT);
    await prisma.teacher.update({ where: { id: teacherId }, data: { passwordHash } });

    return res.json({ message: "Parol yangilandi" });
  } catch (e) {
    console.error("[PROFILE CHANGE_PASSWORD]", e);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

// POST /api/profile/avatar


exports.UPLOAD_AVATAR = async (req, res) => {
  try {
    const teacherId = req.user?.teacherId || req.user?.id;

    if (!teacherId) {
      return res.status(401).json({ message: "Foydalanuvchi aniqlanmadi" });
    }

    if (!req.files || !req.files.avatar) {
      return res.status(400).json({ message: "Avatar fayli kerak" });
    }

    const avatarFile = Array.isArray(req.files.avatar)
      ? req.files.avatar[0]
      : req.files.avatar;

    const allowedMime = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedMime.includes(avatarFile.mimetype)) {
      return res.status(400).json({ message: "Faqat JPG, PNG yoki WEBP rasm bo'lsin" });
    }

    if (avatarFile.size > 2 * 1024 * 1024) {
      return res.status(400).json({ message: "Rasm hajmi 2MB dan katta bo'lmasin" });
    }

    const existing = await prisma.teacher.findUnique({
      where: { id: Number(teacherId) },
      select: { avatarUrl: true },
    });

    const uploadDir = path.join(process.cwd(), "uploads", "avatars");
    fs.mkdirSync(uploadDir, { recursive: true });

    const ext = path.extname(avatarFile.name || ".jpg").toLowerCase() || ".jpg";
    const filename = `t_${teacherId}_${Date.now()}${ext}`;
    const uploadPath = path.join(uploadDir, filename);

    await avatarFile.mv(uploadPath);

    const avatarUrl = `/uploads/avatars/${filename}`;

    await prisma.teacher.update({
      where: { id: Number(teacherId) },
      data: { avatarUrl },
    });

    // eski avatarni oxirida o‘chirish xavfsizroq
    if (
      existing?.avatarUrl &&
      existing.avatarUrl.startsWith("/uploads/avatars/") &&
      existing.avatarUrl !== avatarUrl
    ) {
      try {
        const oldAbs = path.join(process.cwd(), existing.avatarUrl.replace(/^\//, ""));
        if (fs.existsSync(oldAbs)) {
          fs.unlinkSync(oldAbs);
        }
      } catch (e) {
        console.error("[OLD AVATAR DELETE ERROR]", e);
      }
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id: Number(teacherId) },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
      },
    });

    return res.json({
      message: "Avatar yangilandi",
      teacher,
    });
  } catch (e) {
    console.error("[PROFILE UPLOAD_AVATAR]", e);
    return res.status(500).json({ message: e?.message || "Server xatoligi" });
  }
};
// GET /api/profile/billing/payments
exports.MY_BILLING_PAYMENTS = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const items = await prisma.billingPayment.findMany({
      where: { teacherId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true, amount: true, months: true, status: true,
        proofUrl: true, note: true, rejectReason: true,
        createdAt: true, confirmedAt: true,
      },
    });
    return res.json({ items });
  } catch (e) {
    console.error("[PROFILE BILLING]", e);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};
