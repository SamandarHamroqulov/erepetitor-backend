function normalizeMonthYM(dateStr) {
  // input: "YYYY-MM-DD" -> output: "YYYY-MM"
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  return dateStr.slice(0, 7);
}

module.exports = { normalizeMonthYM };