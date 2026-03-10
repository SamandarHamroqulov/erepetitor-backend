const prisma = require("../services/prismaClient");
const bcrypt = require("bcrypt");
const generateOTP = require("../utils/otp");
const {
  createAccessToken,
  createRefreshToken,
  parseRefreshToken,
} = require("../services/jwt.service");

const { sendOtpEmail, sendLoginAlertEmail } = require("../services/email.service");

const normalizeEmail = (e) => String(e || "").trim().toLowerCase();
const SALT = 10;
const OTP_TTL_SEC = 60;
const MAX_ATTEMPTS = 5;


// OTP create helper (EMAIL-BASED)
async function createOtp({ email, purpose }) {
  const code = generateOTP();
  const codeHash = await bcrypt.hash(code, SALT);
  const expiresAt = new Date(Date.now() + OTP_TTL_SEC * 1000);

  const e = normalizeEmail(email);

  await prisma.otpCode.deleteMany({ where: { email: e, purpose } });
  await prisma.otpCode.create({
    data: { email: e, codeHash, purpose, expiresAt },
  });


  try {
    await sendOtpEmail(e, code, OTP_TTL_SEC);
  } catch (err) {
    console.error("[EMAIL FAILED]", { email: e, purpose, error: err?.message || err });
  }

  return expiresAt;
}

async function verifyOtp({ email, purpose, code }) {
  const e = normalizeEmail(email);

  const otp = await prisma.otpCode.findFirst({
    where: { email: e, purpose },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) return { ok: false, message: "OTP topilmadi" };
  if (new Date() > otp.expiresAt) return { ok: false, message: "OTP muddati tugagan" };

  const match = await bcrypt.compare(code, otp.codeHash);
  if (!match) return { ok: false, message: "Kod noto'g'ri" };

  await prisma.otpCode.deleteMany({ where: { id: otp.id } });

  return { ok: true };
}

// ================= REGISTER =================
exports.REGISTER = async (req, res) => {
  try {
    const { name, password } = req.body;
    const email = normalizeEmail(req.body.email);

    if (!email) return res.status(400).json({ message: "Email kerak" });
    if (!password) return res.status(400).json({ message: "Parol kerak" });

    let teacherId = null;

    const existing = await prisma.teacher.findUnique({ where: { email } });
    if (existing) {
      if (existing.isVerified) {
        return res.status(400).json({ message: "Bu email allaqachon ro'yxatdan o'tgan" });
      }

      // If user exists but is NOT verified, we safely transition them to verified state by replacing their password and sending a new OTP.
      const passwordHash = await bcrypt.hash(password, SALT);
      await prisma.teacher.update({
        where: { id: existing.id },
        data: { passwordHash },
      });
      teacherId = existing.id;
    } else {
      const passwordHash = await bcrypt.hash(password, SALT);

      const teacher = await prisma.teacher.create({
        data: { name, email, passwordHash, isVerified: false },
      });
      teacherId = teacher.id;
    }

    await createOtp({ email, purpose: "REGISTER" });

    return res.status(201).json({
      message: "Kod email orqali yuborildi",
      teacherId,
      ttlSec: OTP_TTL_SEC,
    });
  } catch (err) {
    console.error(err);
    if (err.code === "P2002") {
      return res.status(400).json({ message: "Bu email allaqachon ro'yxatdan o'tgan" });
    }
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

// ================= RESEND OTP (REGISTER) =================
exports.RESEND_OTP = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) return res.status(400).json({ message: "Email kerak" });

    const teacher = await prisma.teacher.findUnique({
      where: { email },
      select: { id: true, isVerified: true },
    });

    if (!teacher) return res.status(400).json({ message: "Foydalanuvchi topilmadi" });
    if (teacher.isVerified) {
      return res.status(400).json({ message: "Email allaqachon tasdiqlangan" });
    }

    const expiresAt = await createOtp({ email, purpose: "REGISTER" });

    return res.json({
      message: "Yangi OTP email orqali yuborildi",
      expiresAt,
      ttlSec: OTP_TTL_SEC,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

// ================= VERIFY OTP (REGISTER) =================
// ✅ TRIAL subscription yaratadi
exports.VERIFY_OTP = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const code = String(req.body.code || "").trim();

    if (!email) return res.status(400).json({ message: "Email kerak" });
    if (!code) return res.status(400).json({ message: "code kerak" });

    const otp = await prisma.otpCode.findFirst({
      where: { email, purpose: "REGISTER" },
      orderBy: { createdAt: "desc" },
      select: { id: true, codeHash: true, expiresAt: true, attempts: true },
    });

    if (!otp) return res.status(400).json({ message: "OTP topilmadi" });

    const now = new Date();
    if (now > otp.expiresAt) {
      return res.status(400).json({ message: "OTP muddati tugagan", expiresAt: otp.expiresAt });
    }

    if ((otp.attempts || 0) >= MAX_ATTEMPTS) {
      return res.status(400).json({
        message: "Ko'p urinish. OTPni qayta yuboring.",
        expiresAt: otp.expiresAt,
      });
    }

    const ok = await bcrypt.compare(code, otp.codeHash);

    if (!ok) {
      const updated = await prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
        select: { attempts: true, expiresAt: true },
      });

      return res.status(400).json({
        message: "Kod noto'g'ri",
        attemptsLeft: Math.max(0, MAX_ATTEMPTS - updated.attempts),
        expiresAt: updated.expiresAt,
      });
    }

    const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      const teacher = await tx.teacher.update({
        where: { email },
        data: { isVerified: true },
        select: { id: true },
      });

      await tx.subscription.upsert({
        where: { teacherId: teacher.id },
        update: {},
        create: {
          teacherId: teacher.id,
          status: "TRIAL",
          trialEndsAt: trialEnd,
          currentPeriodEndsAt: trialEnd,
        },
      });

      await tx.otpCode.deleteMany({ where: { email, purpose: "REGISTER" } });
    });

    return res.json({
      message: "Email tasdiqlandi",
      verified: true,
      trialEndsAt: trialEnd,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

// ================= LOGIN =================
exports.LOGIN = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    if (!email) return res.status(400).json({ message: "Email kerak" });
    if (!password) return res.status(400).json({ message: "Parol kerak" });

    const teacher = await prisma.teacher.findUnique({
      where: { email },
    });

    if (!teacher)
      return res.status(400).json({ message: "Foydalanuvchi topilmadi" });

    if (!teacher.isVerified)
      return res.status(403).json({ message: "Avval emailni tasdiqlang" });

    if (!teacher.passwordHash)
      return res.status(400).json({ message: "Parol o'rnatilmagan" });

    const match = await bcrypt.compare(password, teacher.passwordHash);
    if (!match) return res.status(400).json({ message: "Parol noto'g'ri" });

    const role = teacher.role || "TEACHER";
    const accessToken = createAccessToken({ teacherId: teacher.id, role });
    const refreshToken = createRefreshToken({ teacherId: teacher.id, role });

    const refreshTokenHash = await bcrypt.hash(refreshToken, SALT);

    await prisma.teacher.update({
      where: { id: teacher.id },
      data: { refreshTokenHash },
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 90 * 24 * 60 * 60 * 1000,
    });

    // Login alert email — loginni bloklamaslik uchun backgroundga tashlaymiz
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      req.ip ||
      "Noma'lum";

    const userAgent = req.headers["user-agent"] || "Noma'lum qurilma";
    const loginTime = new Date().toLocaleString("uz-UZ", {
      timeZone: "Asia/Tashkent",
    });

    sendLoginAlertEmail({
      to: teacher.email,
      name: teacher.fullName || teacher.name || teacher.email,
      ip,
      userAgent,
      time: loginTime,
    }).catch((err) => {
      console.error("Login alert email yuborilmadi:", err.message);
    });

    return res.json({
      message: "Muvaffaqiyatli login",
      teacherId: teacher.id,
      accessToken,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};
// ================= FORGOT PASSWORD (REQUEST OTP) =================
exports.FORGOT_PASSWORD = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) return res.status(400).json({ message: "Email kerak" });

    const teacher = await prisma.teacher.findUnique({ where: { email } });
    if (!teacher)
      return res.status(400).json({ message: "Foydalanuvchi topilmadi" });

    await createOtp({ email, purpose: "RESET_PASSWORD" });

    return res.json({
      message: "Parolni tiklash uchun OTP email orqali yuborildi",
      ttlSec: OTP_TTL_SEC,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

// ================= RESET PASSWORD (CONFIRM OTP + NEW PASSWORD) =================
exports.RESET_PASSWORD = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const code = String(req.body.code || "").trim();
    const { newPassword } = req.body;

    if (!email) return res.status(400).json({ message: "Email kerak" });
    if (!code) return res.status(400).json({ message: "code kerak" });
    if (!newPassword) return res.status(400).json({ message: "newPassword kerak" });

    const result = await verifyOtp({ email, purpose: "RESET_PASSWORD", code });
    if (!result.ok) return res.status(400).json({ message: result.message });

    const newPasswordHash = await bcrypt.hash(newPassword, SALT);

    await prisma.teacher.update({
      where: { email },
      data: { passwordHash: newPasswordHash },
    });

    return res.json({ message: "Parol muvaffaqiyatli yangilandi" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

// ================= CHANGE PASSWORD (LOGGED IN) =================
exports.CHANGE_PASSWORD = async (req, res) => {
  try {
    const teacherId = req.user?.teacherId;
    const { currentPassword, newPassword } = req.body;

    if (!teacherId)
      return res.status(401).json({ message: "Token yo'q yoki noto'g'ri" });
    if (!currentPassword) return res.status(400).json({ message: "currentPassword kerak" });
    if (!newPassword) return res.status(400).json({ message: "newPassword kerak" });

    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } });
    if (!teacher)
      return res.status(400).json({ message: "Foydalanuvchi topilmadi" });

    if (!teacher.passwordHash)
      return res.status(400).json({ message: "Parol o'rnatilmagan" });

    const match = await bcrypt.compare(currentPassword, teacher.passwordHash);
    if (!match)
      return res.status(400).json({ message: "Joriy parol noto'g'ri" });

    const newPasswordHash = await bcrypt.hash(newPassword, SALT);

    await prisma.teacher.update({
      where: { id: teacherId },
      data: { passwordHash: newPasswordHash },
    });

    return res.json({ message: "Parol muvaffaqiyatli o'zgartirildi" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

// ================= REFRESH =================
exports.REFRESH = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ message: "Refresh token yo'q" });
    }

    const payload = parseRefreshToken(refreshToken);

    const teacher = await prisma.teacher.findUnique({
      where: { id: payload.teacherId },
    });

    if (!teacher || !teacher.refreshTokenHash) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const ok = await bcrypt.compare(refreshToken, teacher.refreshTokenHash);
    if (!ok) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const role = teacher.role || "TEACHER";
    const newAccessToken = createAccessToken({ teacherId: teacher.id, role });
    const newRefreshToken = createRefreshToken({ teacherId: teacher.id, role });

    const newHash = await bcrypt.hash(newRefreshToken, SALT);
    await prisma.teacher.update({
      where: { id: teacher.id },
      data: { refreshTokenHash: newHash },
    });

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" ? true : false,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 90 * 24 * 60 * 60 * 1000,
    });

    return res.json({ accessToken: newAccessToken });
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

// ================= LOGOUT =================
exports.LOGOUT = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (refreshToken) {
      const payload = parseRefreshToken(refreshToken);

      await prisma.teacher.update({
        where: { id: payload.teacherId },
        data: { refreshTokenHash: null },
      });
    }

    res.clearCookie("refreshToken");

    return res.json({ message: "Logout bo'ldi" });
  } catch (err) {
    res.clearCookie("refreshToken");
    return res.json({ message: "Logout bo'ldi" });
  }
};