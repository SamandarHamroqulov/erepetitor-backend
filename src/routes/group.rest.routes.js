const { Router } = require("express");
const g = require("../controllers/group.rest.controller");
const attendance = require("../controllers/attendance.controller");
const attendanceStats = require("../controllers/attendance.stats.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const subscriptionMiddleware = require("../middlewares/subscription.middleware");
const fileUpload = require("express-fileupload");

const router = Router();

router.get("/",     g.LIST);
router.post("/",    g.CREATE);
router.get("/:id",  g.DETAIL);
router.patch("/:id", g.UPDATE);
router.put("/:id", authMiddleware, g.EDIT);
router.delete("/:id", g.DELETE);
router.get("/:id/overview", authMiddleware, subscriptionMiddleware, g.OVERVIEW);

// Bulk actions
router.post("/:id/students/remove", authMiddleware, g.BULK_REMOVE_STUDENTS);
router.post("/:id/students/move", authMiddleware, g.BULK_MOVE_STUDENTS);

// Import
router.post("/:id/students/import-preview", authMiddleware, fileUpload({
  limits: { fileSize: 5 * 1024 * 1024 },
  abortOnLimit: true
}), g.IMPORT_PREVIEW);

router.post("/:id/students/import-bulk", authMiddleware, g.IMPORT_BULK);

// Attendance — single day
router.get("/:id/attendance", authMiddleware, attendance.GET_ATTENDANCE);
router.post("/:id/attendance", authMiddleware, attendance.MARK_ATTENDANCE);
router.put("/:id/attendance", authMiddleware, attendance.BULK_MARK);

// Attendance — monthly stats
router.get("/:id/attendance/monthly-stats", authMiddleware, attendanceStats.MONTHLY_STATS);

module.exports = router;
