const { Router } = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const subscriptionMiddleware = require("../middlewares/subscription.middleware");

const authRouter        = require("./auth.routes");
const profileRouter     = require("./profile.routes");
const billingRouter     = require("./billing.routes");
const adminRouter       = require("./admin.routes");
const groupRouter       = require("./group.rest.routes");
const studentRouter     = require("./student.rest.routes");
const paymentRouter     = require("./payment.routes");
const dashboardRouter   = require("./dashboard.main.routes");
const nextLessonRouter  = require("./dashboard.nextLessons.routes");
const groupScheduleRouter = require("./groupSchedule.routes");

const router = Router();

// Public
router.use("/auth", authRouter);

// Authenticated
router.use(authMiddleware);
router.use("/profile", profileRouter);
router.use("/billing", billingRouter);
router.use("/admin",   adminRouter);

// Subscription check
router.use(subscriptionMiddleware);

router.use("/groups",        groupRouter);
router.use("/students",      studentRouter);
router.use("/payments",      paymentRouter);
router.use("/dashboard",     dashboardRouter);
router.use("/next-lessons",  nextLessonRouter);
router.use("/group-schedules", groupScheduleRouter);

module.exports = router;
