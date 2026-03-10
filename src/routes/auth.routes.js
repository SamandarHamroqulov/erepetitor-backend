const { Router } = require("express");
const c = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware");

const router = Router();

router.post("/register", c.REGISTER);
router.post("/verify-otp", c.VERIFY_OTP);
router.post("/resend-otp", c.RESEND_OTP);
router.post("/login", c.LOGIN);
router.post("/refresh", c.REFRESH);
router.post("/logout", authMiddleware, c.LOGOUT);
router.post("/forgot-password", c.FORGOT_PASSWORD);
router.post("/reset-password", c.RESET_PASSWORD);
router.post("/change-password", authMiddleware, c.CHANGE_PASSWORD);

module.exports = router;
