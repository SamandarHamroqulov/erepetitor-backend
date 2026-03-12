const profileRouter = require("express").Router();
const auth = require("../middlewares/auth.middleware");
const c = require("../controllers/profile.controller");
const fileUpload = require("express-fileupload");

// Profile info
profileRouter.get("/me", auth, c.ME);
profileRouter.patch("/me", auth, c.UPDATE_ME);

// Change password
profileRouter.post("/change-password", auth, c.CHANGE_PASSWORD);

// Avatar upload
profileRouter.post(
  "/avatar",
  auth,
  fileUpload({
    createParentPath: true,
    limits: { fileSize: 2 * 1024 * 1024 },
    abortOnLimit: true,
    useTempFiles: false,
  }),
  c.UPLOAD_AVATAR
);

// Billing history
profileRouter.get("/billing/payments", auth, c.MY_BILLING_PAYMENTS);

module.exports = profileRouter;