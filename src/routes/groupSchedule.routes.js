const { Router } = require("express");
const auth = require("../middlewares/auth.middleware");
const c = require("../controllers/groupSchedule.controller");

const groupScheduleRouter = Router();

groupScheduleRouter.get("/", auth, c.LIST);
groupScheduleRouter.post("/", auth, c.CREATE);
groupScheduleRouter.patch("/:id/toggle", auth, c.TOGGLE);
groupScheduleRouter.delete("/:id", auth, c.DELETE);

module.exports = groupScheduleRouter;