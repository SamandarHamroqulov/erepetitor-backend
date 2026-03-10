const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * @param {Object} options
 * @param {string} options.to
 * @param {string} options.subject
 * @param {string} options.text
 * @param {string} options.html
 */
async function sendEmail({ to, subject, text, html }) {
  const from = process.env.EMAIL_FROM || `"eRepetitor" <${process.env.EMAIL_USER}>`;

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html: html || text,
  });
}

/**
 * @param {string} to
 * @param {string} code
 * @param {number} ttlSec
 */
async function sendOtpEmail(to, code, ttlSec = 60) {
  const from = process.env.EMAIL_FROM || `"eRepetitor" <${process.env.EMAIL_USER}>`;

  await transporter.sendMail({
    from,
    to,
    subject: "eRepetitor — Tasdiqlash kodi",
    text: `Tasdiqlash kodingiz: ${code}\n\nKod ${ttlSec} soniya ichida amal qiladi.\n\nAgar siz so'ramagan bo'lsangiz, ushbu xabarni e'tiborsiz qoldiring.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #f8fafc; border-radius: 16px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #2563eb, #4f46e5); padding: 32px 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">📚 eRepetitor</h1>
          <p style="color: #bfdbfe; margin: 8px 0 0; font-size: 14px;">Repetitorlar uchun aqlli tizim</p>
        </div>
        <div style="padding: 32px 24px; background: white;">
          <p style="color: #475569; font-size: 15px; margin: 0 0 24px;">Sizning tasdiqlash kodingiz:</p>
          <div style="background: #f1f5f9; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px; letter-spacing: 8px; font-size: 36px; font-weight: bold; color: #1e40af;">
            ${code}
          </div>
          <p style="color: #94a3b8; font-size: 13px; margin: 0; text-align: center;">
            Kod <strong>${ttlSec} soniya</strong> ichida amal qiladi.<br/>
            Agar siz so'ramagan bo'lsangiz, e'tiborsiz qoldiring.
          </p>
        </div>
      </div>
    `,
  });
}

/**
 * @param {Object} options
 * @param {string} options.to
 * @param {string} [options.name]
 * @param {string} [options.ip]
 * @param {string} [options.userAgent]
 * @param {string} [options.time]
 */
async function sendLoginAlertEmail({ to, name, ip, userAgent, time }) {
  const safeName = name || "Foydalanuvchi";
  const safeIp = ip || "Noma'lum";
  const safeUserAgent = userAgent || "Noma'lum qurilma";
  const safeTime = time || new Date().toLocaleString("uz-UZ");

  return sendEmail({
    to,
    subject: "eRepetitor — Hisobingizga kirildi",
    text: `
Salom, ${safeName}!

Hisobingizga muvaffaqiyatli kirildi.

Vaqt: ${safeTime}
IP manzil: ${safeIp}
Qurilma/Brauzer: ${safeUserAgent}

Agar bu siz bo'lmasangiz, darhol parolingizni almashtiring.
    `.trim(),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #f8fafc; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
        <div style="background: linear-gradient(135deg, #0f172a, #1e3a8a); padding: 28px 24px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 24px;">🔐 eRepetitor</h1>
          <p style="color: #cbd5e1; margin: 8px 0 0; font-size: 14px;">Login haqida ogohlantirish</p>
        </div>

        <div style="padding: 28px 24px; background: #ffffff;">
          <p style="margin: 0 0 16px; color: #334155; font-size: 15px;">
            Salom, <strong>${safeName}</strong>!
          </p>

          <p style="margin: 0 0 20px; color: #475569; font-size: 15px;">
            Hisobingizga muvaffaqiyatli kirildi.
          </p>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
            <p style="margin: 0 0 10px; color: #0f172a; font-size: 14px;"><strong>Vaqt:</strong> ${safeTime}</p>
            <p style="margin: 0 0 10px; color: #0f172a; font-size: 14px;"><strong>IP manzil:</strong> ${safeIp}</p>
            <p style="margin: 0; color: #0f172a; font-size: 14px;"><strong>Qurilma/Brauzer:</strong> ${safeUserAgent}</p>
          </div>

          <div style="background: #fff7ed; border: 1px solid #fdba74; color: #9a3412; border-radius: 12px; padding: 14px; font-size: 14px;">
            Agar bu login siz tomonidan amalga oshirilmagan bo‘lsa, darhol parolingizni almashtiring.
          </div>
        </div>
      </div>
    `,
  });
}

module.exports = {
  sendEmail,
  sendOtpEmail,
  sendLoginAlertEmail,
};