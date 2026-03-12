const { Router } = require("express");
const auth = require("../middlewares/auth.middleware");
const s = require("../controllers/student.rest.controller");
const validateUpdate = require("../validators/studentUpdate.validator");
const studentRestRouter = Router();

studentRestRouter.get("/", auth, s.LIST);
studentRestRouter.post("/", auth, s.CREATE);
studentRestRouter.get("/:id", auth, s.DETAIL);
studentRestRouter.get("/:id/history", auth, s.HISTORY);
studentRestRouter.patch("/:id", auth, validateUpdate, s.UPDATE);
studentRestRouter.patch("/:id/transfer", auth, s.TRANSFER);  // boshqa guruhga o'tkazish
studentRestRouter.delete("/:id", auth, s.DELETE);             // guruhdan chiqarish (arxivlash)
studentRestRouter.post("/:id/restore", auth, s.RESTORE);      // arxivdan tiklash

module.exports = studentRestRouter;