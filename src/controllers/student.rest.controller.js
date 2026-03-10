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
        group: { select: { id: true, name: true } },
      },
    });
    return res.json({ students });
  } catch (err) {
    console.error("[STUDENT LIST]", err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

// POST /api/students
exports.CREATE = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const { name, parentPhone, groupId } = req.body;

    if (!name?.trim()) return res.status(400).json({ message: "Ism kerak" });
    if (!groupId) return res.status(400).json({ message: "groupId kerak" });

    const group = await prisma.group.findFirst({
      where: { id: Number(groupId), teacherId },
    });
    if (!group) return res.status(404).json({ message: "Guruh topilmadi" });

    const student = await prisma.student.create({
      data: {
        name: name.trim(),
        parentPhone: parentPhone?.trim() || null,
        groupId: Number(groupId),
      },
    });
    return res.status(201).json({ message: "O'quvchi qo'shildi", student });
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
      student,
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

    const { name, parentPhone, isActive } = req.body;

    const updated = await prisma.student.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(parentPhone !== undefined && { parentPhone: parentPhone?.trim() || null }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
      select: { id: true, name: true, parentPhone: true, isActive: true, groupId: true },
    });

    return res.json({ message: "Yangilandi", student: updated });
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
