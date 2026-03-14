const { Router } = require("express");
const p = require("../controllers/payment.controller");
const { NOTIFY_DEBTORS } = require("../controllers/payment.notify.controller");

const router = Router();
router.get("/debtors",     p.DEBTORS);
router.get("/paid",        p.PAID);
router.get("/all",         p.ALL);
router.get("/export",      p.EXPORT_XLSX);

router.post("/create-month",   p.CREATE_MONTH);
router.post("/create-one",     p.CREATE_ONE);
router.post("/notify-debtors", NOTIFY_DEBTORS);

router.patch("/:id/pay",   p.PAY);
router.patch("/:id/unpay", p.UNPAY);
router.patch("/:id/amount", p.UPDATE_AMOUNT);

module.exports = router;
