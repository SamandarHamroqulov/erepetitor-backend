const prisma = require("../services/prismaClient");
const { normalizeMonthYM } = require("../utils/month");
const ExcelJS = require("exceljs");


// =================== CREATE_MONTH ===================
exports.CREATE_MONTH = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const { groupId, date } = req.body;

    const month = normalizeMonthYM(date);
    if (!month) {
      return res.status(400).json({ message: "date noto'g'ri format (YYYY-MM-DD)" });
    }

    if (!groupId) {
      return res.status(400).json({ message: "groupId kerak" });
    }

    const group = await prisma.group.findFirst({
      where: { id: Number(groupId), teacherId },
      select: { id: true, monthlyPrice: true },
    });

    if (!group) {
      return res.status(404).json({ message: "Guruh topilmadi" });
    }

    const students = await prisma.student.findMany({
      where: { groupId: Number(groupId), isActive: true },
      select: { id: true },
    });

    if (!students.length) {
      return res.status(400).json({ message: "Bu guruhda faol o'quvchi yo'q" });
    }

    const result = await prisma.payment.createMany({
      data: students.map((s) => ({
        studentId: s.id,
        month,
        amount: group.monthlyPrice,
        status: "DUE",
      })),
      skipDuplicates: true,
    });

    return res.status(201).json({
      message: "Oylik to'lovlar yaratildi",
      createdCount: result.count,
      month,
    });

  } catch (err) {
    console.error("[PAYMENT CREATE_MONTH]", err);
    res.status(500).json({ message: "Server xatoligi" });
  }
};


// =================== CREATE_ONE ===================
exports.CREATE_ONE = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const { studentId, date } = req.body;

    const month = normalizeMonthYM(date);

    if (!month) {
      return res.status(400).json({ message: "date kerak (YYYY-MM-DD)" });
    }

    if (!studentId) {
      return res.status(400).json({ message: "studentId kerak" });
    }

    const student = await prisma.student.findFirst({
      where: { id: Number(studentId), group: { teacherId } },
      select: {
        id: true,
        isActive: true,
        group: { select: { monthlyPrice: true } },
      },
    });

    if (!student) {
      return res.status(404).json({ message: "O'quvchi topilmadi" });
    }

    if (!student.isActive) {
      return res.status(400).json({ message: "O'quvchi faol emas" });
    }

    const exists = await prisma.payment.findUnique({
      where: { studentId_month: { studentId: student.id, month } },
    });

    if (exists) {
      return res.json({
        message: "Bu oy uchun to'lov allaqachon mavjud",
        paymentId: exists.id,
      });
    }

    const payment = await prisma.payment.create({
      data: {
        studentId: student.id,
        month,
        amount: student.group.monthlyPrice,
        status: "DUE",
      },
    });

    res.status(201).json({
      message: "To'lov yaratildi",
      payment: { ...payment, amount: String(payment.amount) },
    });

  } catch (err) {
    console.error("[PAYMENT CREATE_ONE]", err);
    res.status(500).json({ message: "Server xatoligi" });
  }
};


// =================== LIST ===================
async function listPayments(req, res, statusFilter) {
  try {
    const teacherId = req.user.teacherId;
    const { date, groupId, search } = req.query;

    const month = normalizeMonthYM(date);

    if (!month) {
      return res.status(400).json({ message: "date kerak (YYYY-MM-DD)" });
    }

    const where = {
      month,
      student: {
        group: {
          teacherId,
          ...(groupId ? { id: Number(groupId) } : {}),
        },
        ...(search
          ? { name: { contains: search, mode: "insensitive" } }
          : {}),
      },
      ...(statusFilter ? { status: statusFilter } : {}),
    };

    const items = await prisma.payment.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        student: {
          select: {
            id: true,
            name: true,
            parentPhone: true,
            group: { select: { id: true, name: true } },
          },
        },
      },
    });

    res.json({
      items: items.map((p) => {
        const amount = Number(p.amount);
        const paid = Number(p.paidAmount || 0);

        return {
          ...p,
          amount: String(amount),
          paidAmount: String(paid),
          remaining: String(Math.max(0, amount - paid)),
        };
      }),
    });

  } catch (err) {
    console.error("[PAYMENT LIST]", err);
    res.status(500).json({ message: "Server xatoligi" });
  }
}

exports.DEBTORS = (req, res) => listPayments(req, res, "DUE");
exports.PAID = (req, res) => listPayments(req, res, "PAID");
exports.ALL = (req, res) => listPayments(req, res, null);


// =================== PAY ===================
exports.PAY = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const id = Number(req.params.id);
    const payAmount = Number(req.body?.payAmount);

    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "ID noto'g'ri" });
    }

    if (!Number.isFinite(payAmount) || payAmount <= 0) {
      return res.status(400).json({ message: "payAmount noto'g'ri" });
    }

    const payment = await prisma.payment.findFirst({
      where: { id, student: { group: { teacherId } } },
    });

    if (!payment) {
      return res.status(404).json({ message: "To'lov topilmadi" });
    }

    if (payment.status === "PAID") {
      return res.status(400).json({ message: "Allaqachon to'liq to'langan" });
    }

    const amount = Number(payment.amount);
    const paid = Number(payment.paidAmount || 0);

    const nextPaid = paid + payAmount;

    let status = "PARTIAL";
    let paidAt = null;

    if (nextPaid >= amount) {
      status = "PAID";
      paidAt = new Date();
    }

    const updated = await prisma.payment.update({
      where: { id },
      data: {
        paidAmount: nextPaid,
        status,
        ...(paidAt && { paidAt }),
      },
    });

    res.json({
      message: "To'lov qo'shildi",
      payment: {
        ...updated,
        amount: String(updated.amount),
        paidAmount: String(updated.paidAmount),
      },
    });

  } catch (err) {
    console.error("[PAYMENT PAY]", err);
    res.status(500).json({ message: "Server xatoligi" });
  }
};


// =================== UNPAY ===================
exports.UNPAY = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const id = Number(req.params.id);

    const payment = await prisma.payment.findFirst({
      where: { id, student: { group: { teacherId } } },
    });

    if (!payment) {
      return res.status(404).json({ message: "To'lov topilmadi" });
    }

    const updated = await prisma.payment.update({
      where: { id },
      data: {
        status: "DUE",
        paidAmount: 0,
        paidAt: null,
      },
    });

    res.json({
      message: "Qayta qarzdor qilindi",
      payment: {
        ...updated,
        amount: String(updated.amount),
        paidAmount: String(updated.paidAmount),
      },
    });

  } catch (err) {
    console.error("[PAYMENT UNPAY]", err);
    res.status(500).json({ message: "Server xatoligi" });
  }
};
exports.EXPORT_XLSX = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const { date, status, groupId, search } = req.query;

    const month = normalizeMonthYM(date);
    if (!month)
      return res.status(400).json({ message: "date kerak (YYYY-MM-DD)" });

    const where = {
      month,
      student: {
        group: {
          teacherId,
          ...(groupId ? { id: Number(groupId) } : {}),
        },
        ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
      },
      ...(status ? { status } : {}),
    };

    const items = await prisma.payment.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        student: {
          select: {
            name: true,
            parentPhone: true,
            group: { select: { name: true } },
          },
        },
      },
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("To'lovlar");

    ws.columns = [
      { header: "Guruh", key: "group", width: 24 },
      { header: "O'quvchi", key: "student", width: 22 },
      { header: "Telefon", key: "phone", width: 16 },
      { header: "Oy", key: "month", width: 10 },
      { header: "Summa", key: "amount", width: 14 },
      { header: "Holat", key: "status", width: 10 },
      { header: "To'langan sana", key: "paidAt", width: 18 },
    ];
    ws.getRow(1).font = { bold: true };

    for (const p of items) {
      ws.addRow({
        group: p.student.group.name,
        student: p.student.name,
        phone: p.student.parentPhone || "",
        month,
        amount: String(p.amount),
        status: p.status === "PAID" ? "To'langan" : "Qarzdor",
        paidAt: p.paidAt ? new Date(p.paidAt).toISOString().slice(0, 10) : "",
      });
    }

    const fileName = `payments_${month}${status ? "_" + status : ""}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("[PAYMENT EXPORT]", err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};
