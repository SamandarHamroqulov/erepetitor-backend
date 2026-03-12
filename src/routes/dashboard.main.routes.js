const { Router } = require("express");
const auth = require("../middlewares/auth.middleware");
const d = require("../controllers/dashboard.main.controller");

const dashboarMainRouter = Router();
dashboarMainRouter.get("/main", auth, d.MAIN);

module.exports = dashboarMainRouter;