function normalizeUzPhone(input) {
  const raw = String(input || "").replace(/\D/g, ""); // faqat raqam
  if (!raw) return null;

  // +998901234567 yoki 998901234567 yoki 901234567 yoki 0901234567 kabi kirishi mumkin
  if (raw.startsWith("998") && raw.length === 12) return `+${raw}`;
  if (raw.length === 9) return `+998${raw}`;
  if (raw.length === 10 && raw.startsWith("0")) return `+998${raw.slice(1)}`;

  // fallback: agar + bilan kelgan bo‘lsa
  if (String(input).trim().startsWith("+") && raw.length >= 10) return `+${raw}`;

  return null;
}

module.exports = { normalizeUzPhone };