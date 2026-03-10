require("dotenv").config();
const jwt = require("jsonwebtoken");

module.exports = {
  createAccessToken(payload) {
    return jwt.sign(payload, process.env.JWT_ACCESSTOKEN_SECRET, {
      expiresIn: "5m",
    });
  },
  parseAccessToken(token) {
    return jwt.verify(token, process.env.JWT_ACCESSTOKEN_SECRET);
  },

  createRefreshToken(payload) {
    return jwt.sign(payload, process.env.JWT_REFRESHTOKEN_SECRET, {
      expiresIn: "90d",
    });
  },
  parseRefreshToken(token) {
    return jwt.verify(token, process.env.JWT_REFRESHTOKEN_SECRET);
  },
};
