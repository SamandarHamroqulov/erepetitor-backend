const { parseAccessToken } = require("../services/jwt.service");

module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Header yo'q
    if (!authHeader) {
      return res.status(401).json({ message: "Token yo'q" });
    }

    // "Bearer token"
    const parts = authHeader.split(" ");
    if (parts.length !== 2) {
      return res.status(401).json({ message: "Token formati noto'g'ri" });
    }

    const [type, token] = parts;

    if (type !== "Bearer") {
      return res.status(401).json({ message: "Bearer token kerak" });
    }

    // Token verify
    const payload = parseAccessToken(token);

    // payload: { teacherId }
    req.user = payload;

    next();

  } catch (err) {
    // jsonwebtoken errors
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token muddati tugagan" });
    }

    return res.status(401).json({ message: "Token yaroqsiz" });
  }
};