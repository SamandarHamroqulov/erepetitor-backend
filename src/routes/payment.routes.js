const { Router } = require("express");
const p = require("../controllers/payment.controller");

const router = Router();
router.get("/debtors",     p.DEBTORS);
router.get("/paid",        p.PAID);
router.get("/all",         p.ALL);
router.get("/export",      p.EXPORT_XLSX);

router.post("/create-month", p.CREATE_MONTH);
router.post("/create-one",   p.CREATE_ONE);

router.patch("/:id/pay",   p.PAY);
router.patch("/:id/unpay", p.UNPAY);

module.exports = router;
