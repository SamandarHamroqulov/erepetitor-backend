const { Router } = require("express");
const auth = require("../middlewares/auth.middleware");
const d = require("../controllers/dashboard.nextLessons.controller");

const nextLessonRouter = Router();
nextLessonRouter.get("/", auth, d.NEXT_LESSONS);

module.exports = nextLessonRouter;