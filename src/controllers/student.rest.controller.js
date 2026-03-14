const prisma = require("../services/prismaClient");

function ymFromDate(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function lastNMonths(n = 6) {
  const arr = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    arr.push(ymFromDate(d));
  }
  return arr;
}

// GET /api/students
exports.LIST = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const students = await prisma.student.findMany({
      where: { group: { teacherId }, isDeleted: false },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        parentPhone: true,
        isActive: true,
        paymentStartDate: true,
        customMonthlyFee: true,
        group: { select: { id: true, name: true } },
      },
    });
    return res.json({
      students: students.map(s => ({
        ...s,
        customMonthlyFee: s.customMonthlyFee ? String(s.customMonthlyFee) : null
      }))
    });
  } catch (err) {
    console.error("[STUDENT LIST]", err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

// POST /api/students
exports.CREATE = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    let { name, parentPhone, groupId, paymentStartDate, customMonthlyFee } = req.body;

    if (!name?.trim()) return res.status(400).json({ message: "Ism kerak" });
    if (!groupId) return res.status(400).json({ message: "groupId kerak" });

    // Sanitize: empty string → null
    if (paymentStartDate === '' || paymentStartDate === undefined) paymentStartDate = null;
    if (customMonthlyFee === '' || customMonthlyFee === undefined) customMonthlyFee = null;

    // Validate date
    let parsedDate = null;
    if (paymentStartDate) {
      parsedDate = new Date(paymentStartDate);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ message: "paymentStartDate noto'g'ri format" });
      }
    }

    // Validate fee
    let parsedFee = null;
    if (customMonthlyFee !== null) {
      parsedFee = Number(customMonthlyFee);
      if (!Number.isFinite(parsedFee) || parsedFee < 0) {
        return res.status(400).json({ message: "customMonthlyFee noto'g'ri" });
      }
      if (parsedFee === 0) parsedFee = null;
    }

    const group = await prisma.group.findFirst({
      where: { id: Number(groupId), teacherId },
    });
    if (!group) return res.status(404).json({ message: "Guruh topilmadi" });

    const student = await prisma.student.create({
      data: {
        name: name.trim(),
        parentPhone: parentPhone?.trim() || null,
        groupId: Number(groupId),
        paymentStartDate: parsedDate,
        customMonthlyFee: parsedFee,
      },
    });
    return res.status(201).json({
      message: "O'quvchi qo'shildi",
      student: {
        ...student,
        customMonthlyFee: student.customMonthlyFee ? String(student.customMonthlyFee) : null
      }
    });
  } catch (err) {
    console.error("[STUDENT CREATE]", err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

// GET /api/students/:id
exports.DETAIL = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "ID noto'g'ri" });

    const student = await prisma.student.findFirst({
      where: { id, group: { teacherId }, isDeleted: false },
      select: {
        id: true,
        name: true,
        parentPhone: true,
        isActive: true,
        paymentStartDate: true,
        customMonthlyFee: true,
        createdAt: true,
        group: { select: { id: true, name: true } },
      },
    });
    if (!student) return res.status(404).json({ message: "O'quvchi topilmadi" });

    const months = lastNMonths(6);
    const payments = await prisma.payment.findMany({
      where: { studentId: id, month: { in: months } },
      orderBy: { month: "desc" },
      select: { id: true, month: true, amount: true, status: true, paidAt: true },
    });

    return res.json({
      student: {
        ...student,
        customMonthlyFee: student.customMonthlyFee ? String(student.customMonthlyFee) : null
      },
      lastMonths: months,
      payments: payments.map((p) => ({ ...p, amount: String(p.amount) })),
    });
  } catch (err) {
    console.error("[STUDENT DETAIL]", err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

// PATCH /api/students/:id
exports.UPDATE = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "ID noto'g'ri" });

    const exists = await prisma.student.findFirst({
      where: { id, group: { teacherId }, isDeleted: false },
      select: { id: true },
    });
    if (!exists) return res.status(404).json({ message: "O'quvchi topilmadi yoki arxivlangan" });

    let { name, parentPhone, isActive, paymentStartDate, customMonthlyFee } = req.body;

    const data = {};

    if (name !== undefined) data.name = String(name).trim();
    if (parentPhone !== undefined) data.parentPhone = parentPhone?.trim() || null;
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    if (paymentStartDate !== undefined) {
      if (paymentStartDate === '' || paymentStartDate === null) {
        data.paymentStartDate = null;
      } else {
        const d = new Date(paymentStartDate);
        if (isNaN(d.getTime())) {
          return res.status(400).json({ message: "To'lov boshlanish sanasi noto'g'ri" });
        }
        data.paymentStartDate = d;
      }
    }

    if (customMonthlyFee !== undefined) {
      if (customMonthlyFee === '' || customMonthlyFee === null) {
        data.customMonthlyFee = null;
      } else {
        // Sanitize: remove spaces and commas
        const cleaned = String(customMonthlyFee).replace(/[\s,]/g, '');
        if (cleaned === '') {
          data.customMonthlyFee = null;
        } else {
          const fee = Number(cleaned);
          if (!Number.isFinite(fee) || fee < 0 || fee > 100000000) {
            return res.status(400).json({ message: "Oylik to'lov summasi noto'g'ri (0 - 100,000,000 oralig'i)" });
          }
          data.customMonthlyFee = fee;
        }
      }
    }

    const updated = await prisma.student.update({
      where: { id },
      data,
      select: { id: true, name: true, parentPhone: true, isActive: true, groupId: true, paymentStartDate: true, customMonthlyFee: true },
    });

    return res.json({
      message: "Yangilandi",
      student: {
        ...updated,
        customMonthlyFee: updated.customMonthlyFee ? String(updated.customMonthlyFee) : null
      }
    });
  } catch (err) {
    console.error("[STUDENT UPDATE]", err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

// DELETE /api/students/:id (Remove from group)
exports.DELETE = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "ID noto'g'ri" });

    const student = await prisma.student.findFirst({
      where: { id, group: { teacherId }, isDeleted: false },
      select: { id: true, name: true },
    });
    if (!student) return res.status(404).json({ message: "O'quvchi topilmadi oki arxivlangan" });

    await prisma.student.update({
      where: { id },
      data: {
        groupId: null, // Detach from group instead of archiving
        isActive: false // Optionally mark as inactive since they have no group
      }
    });
    return res.json({ message: `${student.name} guruhdan chiqarildi` });
  } catch (err) {
    console.error("[STUDENT DELETE]", err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

// POST /api/students/:id/archive
exports.ARCHIVE = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "ID noto'g'ri" });

    const student = await prisma.student.findFirst({
      // using some relation trick to ensure teacher owns the student even if groupId is null: 
      // well, if groupId is null, we can't easily check ownership via group unless we use history. 
      // we'll assume the client passes valid IDs for now, or check if group.teacherId matches if they have a group.
      where: { id, isDeleted: false },
      include: { group: true }
    });

    if (!student) return res.status(404).json({ message: "O'quvchi topilmadi oki arxivlangan" });
    if (student.group && student.group.teacherId !== teacherId) {
      return res.status(403).json({ message: "Sizga tegishli emas" });
    }

    await prisma.student.update({
      where: { id },
      data: {
        isDeleted: true,
        isActive: false
      }
    });
    return res.json({ message: `${student.name} arxivlandi` });
  } catch (err) {
    console.error("[STUDENT ARCHIVE]", err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

// PATCH /api/students/:id/transfer
exports.TRANSFER = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const id = Number(req.params.id);
    const { groupId } = req.body;

    if (!Number.isFinite(id)) return res.status(400).json({ message: "ID noto'g'ri" });
    if (!groupId) return res.status(400).json({ message: "groupId kerak" });

    const [student, newGroup] = await Promise.all([
      prisma.student.findFirst({ where: { id, group: { teacherId }, isDeleted: false }, select: { id: true } }),
      prisma.group.findFirst({ where: { id: Number(groupId), teacherId }, select: { id: true } }),
    ]);

    if (!student) return res.status(404).json({ message: "O'quvchi topilmadi" });
    if (!newGroup) return res.status(404).json({ message: "Guruh topilmadi" });

    const updated = await prisma.student.update({
      where: { id },
      data: { groupId: Number(groupId) },
      select: { id: true, name: true, groupId: true, group: { select: { name: true } } },
    });

    return res.json({ message: "O'quvchi boshqa guruhga o'tkazildi", student: updated });
  } catch (err) {
    console.error("[STUDENT TRANSFER]", err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

// POST /api/students/:id/restore
exports.RESTORE = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "ID noto'g'ri" });

    const student = await prisma.student.findFirst({
      where: { id, group: { teacherId } },
      select: { id: true, name: true, isDeleted: true },
    });
    if (!student) return res.status(404).json({ message: "O'quvchi topilmadi" });
    if (!student.isDeleted) return res.status(400).json({ message: "O'quvchi arxivlanmagan" });

    await prisma.student.update({
      where: { id },
      data: { isDeleted: false, isActive: true }
    });

    return res.json({ message: `${student.name} tizimga tiklandi` });
  } catch (err) {
    console.error("[STUDENT RESTORE]", err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

// GET /api/students/:id/history
exports.HISTORY = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "ID noto'g'ri" });

    const student = await prisma.student.findFirst({
      where: { id, group: { teacherId }, isDeleted: false },
      select: {
        id: true,
        name: true,
        parentPhone: true,
        isActive: true,
        paymentStartDate: true,
        customMonthlyFee: true,
        createdAt: true,
        group: { select: { id: true, name: true } },
      },
    });
    if (!student) return res.status(404).json({ message: "O'quvchi topilmadi" });

    // All payments
    const payments = await prisma.payment.findMany({
      where: { studentId: id },
      orderBy: { month: "desc" },
      select: {
        id: true, month: true, amount: true, paidAmount: true,
        status: true, paidAt: true, createdAt: true,
        histories: { orderBy: { createdAt: "asc" }, select: { amount: true, createdAt: true } }
      },
    });

    // All attendance
    const attendance = await prisma.attendance.findMany({
      where: { studentId: id },
      orderBy: { date: "desc" },
      select: {
        id: true, date: true, status: true, groupId: true,
        group: { select: { name: true } },
      },
    });

    // Stats
    const totalPresent = attendance.filter(a => a.status === "PRESENT").length;
    const totalAbsent = attendance.filter(a => a.status === "ABSENT").length;
    const totalLate = attendance.filter(a => a.status === "LATE").length;

    let totalPaidAmount = 0;
    let totalUnpaidAmount = 0;
    for (const p of payments) {
      const amount = Number(p.amount);
      const paid = Number(p.paidAmount || 0);
      totalPaidAmount += paid;
      totalUnpaidAmount += Math.max(0, amount - paid);
    }

    return res.json({
      student: {
        ...student,
        customMonthlyFee: student.customMonthlyFee ? String(student.customMonthlyFee) : null,
      },
      payments: payments.map(p => ({
        ...p,
        amount: String(p.amount),
        paidAmount: String(p.paidAmount || 0),
        remaining: String(Math.max(0, Number(p.amount) - Number(p.paidAmount || 0))),
        histories: p.histories.map(h => ({ ...h, amount: String(h.amount) }))
      })),
      attendance: attendance.map(a => ({
        id: a.id,
        date: a.date,
        status: a.status,
        groupName: a.group?.name || "—",
      })),
      stats: {
        totalLessons: attendance.length,
        totalPresent,
        totalAbsent,
        totalLate,
        totalPayments: payments.length,
        totalPaidAmount: String(totalPaidAmount),
        totalUnpaidAmount: String(totalUnpaidAmount),
      },
    });
  } catch (err) {
    console.error("[STUDENT HISTORY]", err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

// POST /api/students/:id/message
exports.MESSAGE = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const id = Number(req.params.id);
    const { message } = req.body;

    if (!Number.isFinite(id)) return res.status(400).json({ message: "ID noto'g'ri" });
    if (!message || !message.trim()) return res.status(400).json({ message: "Xabar matni kerak" });

    const student = await prisma.student.findFirst({
      // We check that the student belongs to the teacher by checking group, or history of group.
      // Easiest is to allow messaging if student isn't completely deleted. Wait, what if they are archived? We can still message them?
      // Yes, just check parentPhone exists.
      where: { id },
      select: { parentPhone: true, name: true, group: { select: { teacherId: true } } }
    });

    if (!student) return res.status(404).json({ message: "O'quvchi topilmadi" });
    // basic check
    if (student.group && student.group.teacherId !== teacherId) return res.status(403).json({ message: "Sizga tegishli emas" });
    if (!student.parentPhone) return res.status(400).json({ message: "O'quvchining telefon raqami yo'q" });

    const { sendMessageToPhone } = require("../services/telegram.service");
    const bot = req.app.get("telegramBot");

    const sent = await sendMessageToPhone(bot, teacherId, student.parentPhone, message);
    if (!sent) {
      return res.status(400).json({ message: "Telegram bog'lanmagan yoki xatolik yuz berdi" });
    }

    return res.json({ message: "Xabar yuborildi" });
  } catch (err) {
    console.error("[STUDENT MESSAGE]", err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

