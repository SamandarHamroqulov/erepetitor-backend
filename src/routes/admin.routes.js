const { Router } = require("express");
const adminMiddleware = require("../middlewares/admin.middleware");
const admin = require("../controllers/admin.controller");

const router = Router();

// All admin routes require admin role
router.use(adminMiddleware);

router.get("/stats", admin.STATS);

module.exports = router;
