const { Router } = require("express");
const billing = require("../controllers/billing.controller");
const fileUpload = require("express-fileupload");
const path = require("path");
const fs = require("fs");

const router = Router();

// ── Upload setup (billing proof) ─────────────────────────────────────────────
const uploadDir = path.join(process.cwd(), "uploads", "billing");
fs.mkdirSync(uploadDir, { recursive: true });

// Teacher
router.get("/me",             billing.ME);
router.get("/my-payments",    billing.MY_PAYMENTS);
router.post("/create",        billing.CREATE);
router.post(
  "/:id/proof",
  fileUpload({
    createParentPath: true,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    abortOnLimit: true,
    useTempFiles: false,
  }),
  billing.ADD_PROOF
);

// Admin
router.get("/admin/pending",  billing.ADMIN_PENDING);
router.get("/admin/all",      billing.ADMIN_ALL);
router.post("/:id/confirm",   billing.CONFIRM);
router.post("/:id/reject",    billing.REJECT);

module.exports = router;
