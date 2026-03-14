const { Router } = require("express");
const auth = require("../middlewares/auth.middleware");
const { CHARTS } = require("../controllers/dashboard.charts.controller");

const router = Router();
router.get("/charts", auth, CHARTS);

module.exports = router;
