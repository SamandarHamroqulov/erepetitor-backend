const { Router } = require("express");
const g = require("../controllers/group.rest.controller");
const attendance = require("../controllers/attendance.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const subscriptionMiddleware = require("../middlewares/subscription.middleware");

const router = Router();

router.get("/",     g.LIST);
router.post("/",    g.CREATE);
router.get("/:id",  g.DETAIL);
router.patch("/:id", g.UPDATE);
router.put("/:id", authMiddleware, g.EDIT); // Full complete update including schedule
router.delete("/:id", g.DELETE);
router.get("/:id/overview", authMiddleware, subscriptionMiddleware, g.OVERVIEW);

// Bulk actions
router.post("/:id/students/remove", authMiddleware, g.BULK_REMOVE_STUDENTS);
router.post("/:id/students/move", authMiddleware, g.BULK_MOVE_STUDENTS);

// Attendance
router.get("/:id/attendance", authMiddleware, attendance.GET_ATTENDANCE);
router.post("/:id/attendance", authMiddleware, attendance.MARK_ATTENDANCE);
router.put("/:id/attendance", authMiddleware, attendance.BULK_MARK);

module.exports = router;
