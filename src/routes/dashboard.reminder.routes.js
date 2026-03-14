const { Router } = require("express");
const auth = require("../middlewares/auth.middleware");
const { ATTENDANCE_REMINDER } = require("../controllers/dashboard.reminder.controller");

const router = Router();
router.get("/attendance-reminder", auth, ATTENDANCE_REMINDER);

module.exports = router;
