const prisma = require("../services/prismaClient");
const { normalizeMonthYM } = require("../utils/month");

const DAY_MAP = {
  dushanba: "MON", du: "MON",  mon: "MON",
  seshanba: "TUE", se: "TUE",  tue: "TUE",
  chorshanba: "WED", chor: "WED", wed: "WED",
  payshanba: "THU", pay: "THU", thu: "THU",
  juma: "FRI",     jum: "FRI", fri: "FRI",
  shanba: "SAT",   sha: "SAT", sat: "SAT",
  yakshanba: "SUN",yak: "SUN", sun: "SUN",
};

function parseDays(days) {
  if (!Array.isArray(days)) return [];
  return [...new Set(
    days.map(d => DAY_MAP[String(d).trim().toLowerCase()]).filter(Boolean)
  )];
}

// GET /api/groups
exports.LIST = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const groups = await prisma.group.findMany({
      where: { teacherId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { students: true } } },
    });
    return res.json({ groups });
  } catch (err) {
    console.error("[GROUP LIST]", err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

// POST /api/groups
exports.CREATE = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const { name, subject, monthlyPrice, days, time, durationMin } = req.body;

    if (!name?.trim()) return res.status(400).json({ message: "Guruh nomi kerak" });
    if (monthlyPrice === undefined || monthlyPrice === null) {
      return res.status(400).json({ message: "monthlyPrice kerak" });
    }

    const weekdays = parseDays(days);

    if (weekdays.length > 0 && !time) {
      return res.status(400).json({ message: "Kunlar tanlangan bo'lsa time ham kerak" });
    }
    if (time && !/^\d{2}:\d{2}$/.test(time)) {
      return res.status(400).json({ message: "time formati noto'g'ri (HH:MM)" });
    }

    const dur = durationMin !== undefined ? Number(durationMin) : 90;
    if (durationMin !== undefined && (isNaN(dur) || dur < 30 || dur > 300)) {
      return res.status(400).json({ message: "durationMin noto'g'ri (30..300)" });
    }

    const group = await prisma.$transaction(async (tx) => {
      const created = await tx.group.create({
        data: {
          name: name.trim(),
          subject: subject?.trim() || null,
          monthlyPrice: String(monthlyPrice),
          days: Array.isArray(days) ? days : [],
          time: time || null,
          teacherId,
        },
      });

      if (weekdays.length > 0 && time) {
        await tx.groupSchedule.createMany({
          data: weekdays.map((w) => ({
            groupId: created.id,
            weekday: w,
            startTime: time,
            durationMin: dur,
            isActive: true,
          })),
          skipDuplicates: true,
        });
      }

      return created;
    });

    return res.status(201).json({ message: "Guruh yaratildi", group });
  } catch (err) {
    console.error("[GROUP CREATE]", err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

// GET /api/groups/:id?date=YYYY-MM-DD
exports.DETAIL = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "ID noto'g'ri" });

    const month = normalizeMonthYM(req.query.date);
    if (!month) return res.status(400).json({ message: "date kerak (YYYY-MM-DD)" });

    const group = await prisma.group.findFirst({
      where: { id, teacherId },
      select: { id: true, name: true, subject: true, monthlyPrice: true, days: true, time: true, createdAt: true },
    });
    if (!group) return res.status(404).json({ message: "Guruh topilmadi" });

    const [totalStudents, activeStudents] = await Promise.all([
      prisma.student.count({ where: { groupId: id, isDeleted: false } }),
      prisma.student.count({ where: { groupId: id, isActive: true, isDeleted: false } }),
    ]);

    const wherePayments = { month, student: { groupId: id, group: { teacherId }, isDeleted: false } };
    const [dueCount, paidCount, dueAgg, paidAgg] = await Promise.all([
      prisma.payment.count({ where: { ...wherePayments, status: "DUE" } }),
      prisma.payment.count({ where: { ...wherePayments, status: "PAID" } }),
      prisma.payment.aggregate({ where: { ...wherePayments, status: "DUE" }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { ...wherePayments, status: "PAID" }, _sum: { amount: true } }),
    ]);

    const students = await prisma.student.findMany({
      where: { groupId: id, isDeleted: false },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      select: {
        id: true, name: true, parentPhone: true, isActive: true, createdAt: true,
        payments: {
          where: { month },
          select: { id: true, status: true, amount: true, paidAt: true },
          take: 1,
        },
      },
    });

    return res.json({
      month,
      group: { ...group, monthlyPrice: String(group.monthlyPrice) },
      students: {
        total: totalStudents,
        active: activeStudents,
        items: students.map((s) => ({
          id: s.id,
          name: s.name,
          parentPhone: s.parentPhone,
          isActive: s.isActive,
          createdAt: s.createdAt,
          paymentThisMonth: s.payments[0]
            ? { ...s.payments[0], amount: String(s.payments[0].amount) }
            : null,
        })),
      },
      paymentsSummary: {
        counts: { due: dueCount, paid: paidCount, total: dueCount + paidCount },
        sums: {
          due: String(dueAgg._sum.amount ?? 0),
          paid: String(paidAgg._sum.amount ?? 0),
        },
      },
    });
  } catch (err) {
    console.error("[GROUP DETAIL]", err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

// PATCH /api/groups/:id
exports.UPDATE = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "ID noto'g'ri" });

    const exists = await prisma.group.findFirst({ where: { id, teacherId }, select: { id: true } });
    if (!exists) return res.status(404).json({ message: "Guruh topilmadi" });

    const { name, subject, monthlyPrice } = req.body;

    const updated = await prisma.group.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(subject !== undefined && { subject: subject?.trim() || null }),
        ...(monthlyPrice !== undefined && { monthlyPrice: String(monthlyPrice) }),
      },
    });

    return res.json({ message: "Yangilandi", group: updated });
  } catch (err) {
    console.error("[GROUP UPDATE]", err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

// DELETE /api/groups/:id
exports.DELETE = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "ID noto'g'ri" });

    const group = await prisma.group.findFirst({ where: { id, teacherId }, select: { id: true, name: true } });
    if (!group) return res.status(404).json({ message: "Guruh topilmadi" });

    // Arxitektura: agar guruh o'chib ketsa, undagi o'quvchilarni "arxivlaymiz"
    // Va ularning to'lov tarixi saqlanib qolishi uchun, group bilan aloqasini ushlab turamiz.
    // Lekin schema.prisma da student -> group relations Cascade bo'lgani uchun guruhni o'chirish
    // fizik ravishda barcha studentlarni o'chirishga urinadi va bu Payments RESTRICT ga urilib crash beradi.
    // Buni oldini olish uchun: Studentlarni boshq guruhga olib o'tish yoki guruh id sini null qilish kerak (gar nullable bo'lsa),
    // Yoki guruhni ham "isDeleted" qilishimiz kerak.
    // Eng oddiy va tezkor yechim, to'lovlari bor o'quvchilar sababli guruhni o'chirish o'rniga "arxivlash"ni e'lon qilish, 
    // Yoki Prisma transaction yordamida avval studentlarni guruhdan chiqarib, guruhni o'chirmasdan oldin muammo yo'qligiga ishonch qilish.
    
    // We only care if there are ACTIVE, ATTACHED students in this group.
    // Archived students (isDeleted=true) or unassigned students (groupId=null) don't count.
    const activeStudents = await prisma.student.count({ 
        where: { groupId: id, isDeleted: false, isActive: true } 
    });

    if (activeStudents > 0) {
      return res.status(400).json({ 
        message: "Bu guruhda hali faol o'quvchilar bor. Ular avval guruhdan chiqarilishi yoki boshqa guruhga o'tkazilishi kerak." 
      });
    }

    // Endi guruhni butunlay xavfsiz o'chirish mumkin.
    // SCHEMA.PRISMA dagi `onDelete: SetNull` orqali, bu guruhga bog'langan eskiarxivlangan
    // o'quvchilarning `groupId` maydoni avtomatik ravishda bazaning o'zida `null` bo'ladi.
    // Shuning uchun Payment RESTRICT error bermaydi.
    await prisma.group.delete({ where: { id } });
    return res.json({ message: `"${group.name}" guruhi o'chirildi` });
  } catch (err) {
    if (err.code === 'P2003' || String(err.message).includes('violates RESTRICT')) {
      return res.status(400).json({ message: "Guruhda to'lov tarixi bor o'quvchilar qo'lda uzilmagan. O'chirish mumkin emas." });
    }
    console.error("[GROUP DELETE]", err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};



function  getMonthYYYYMM(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// GET /api/groups/:id/overview?month=YYYY-MM
exports.OVERVIEW = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const id = Number(req.params.id);
    const month = String(req.query.month || getMonthYYYYMM()).slice(0, 7);

    if (!Number.isFinite(id)) return res.status(400).json({ message: "ID noto'g'ri" });
    if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ message: "month YYYY-MM bo'lsin" });

    const group = await prisma.group.findFirst({
      where: { id, teacherId },
      select: {
        id: true,
        name: true,
        subject: true,
        monthlyPrice: true,
        days: true,
        time: true,
        createdAt: true,
      },
    });
    if (!group) return res.status(404).json({ message: "Guruh topilmadi" });

    const schedule = await prisma.groupSchedule.findMany({
      where: { groupId: id, isActive: true },
      orderBy: [{ weekday: "asc" }],
      select: { id: true, weekday: true, startTime: true, durationMin: true },
    });

    const students = await prisma.student.findMany({
      where: { groupId: id, isDeleted: false },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        parentPhone: true,
        isActive: true,
        createdAt: true,
        payments: {
          where: { month },
          select: { id: true, status: true, amount: true, paidAt: true },
          take: 1,
        },
      },
    });

    // payments summary
    const wherePayments = { month, student: { groupId: id, group: { teacherId }, isDeleted: false } };
    const [dueCount, paidCount, dueAgg, paidAgg] = await Promise.all([
      prisma.payment.count({ where: { ...wherePayments, status: "DUE" } }),
      prisma.payment.count({ where: { ...wherePayments, status: "PAID" } }),
      prisma.payment.aggregate({ where: { ...wherePayments, status: "DUE" }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { ...wherePayments, status: "PAID" }, _sum: { amount: true } }),
    ]);

    return res.json({
      month,
      group: { ...group, monthlyPrice: String(group.monthlyPrice) },
      schedule,
      students: students.map((s) => ({
        id: s.id,
        name: s.name,
        parentPhone: s.parentPhone,
        isActive: s.isActive,
        createdAt: s.createdAt,
        paymentThisMonth: s.payments[0]
          ? { ...s.payments[0], amount: String(s.payments[0].amount) }
          : null,
      })),
      paymentsSummary: {
        counts: { due: dueCount, paid: paidCount, total: dueCount + paidCount },
        sums: { due: String(dueAgg._sum.amount ?? 0), paid: String(paidAgg._sum.amount ?? 0) },
      },
    });
  } catch (e) {
    console.error("[GROUP OVERVIEW]", e);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

// =======================
// BULK ACTIONS
// =======================

// POST /api/groups/:id/students/remove
exports.BULK_REMOVE_STUDENTS = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const groupId = Number(req.params.id);
    if (!Number.isFinite(groupId)) return res.status(400).json({ message: "Guruh ID noto'g'ri" });

    const group = await prisma.group.findFirst({ where: { id: groupId, teacherId }, select: { id: true } });
    if (!group) return res.status(404).json({ message: "Guruh topilmadi" });

    // O'quvchilarni guruhdan chiqarish (to'la o'chirmasdan, guruhsiz qilish)
    const result = await prisma.student.updateMany({
      where: { groupId, isDeleted: false },
      data: { groupId: null }
    });

    return res.json({ message: `Guruhdagi barcha (${result.count} ta) o'quvchilar guruhdan chiqarildi` });
  } catch (err) {
    console.error("[GROUP BULK REMOVE STUDENTS]", err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

// POST /api/groups/:id/students/move
exports.BULK_MOVE_STUDENTS = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const oldGroupId = Number(req.params.id);
    const targetGroupId = Number(req.body.targetGroupId);

    if (!Number.isFinite(oldGroupId)) return res.status(400).json({ message: "Joriy guruh ID noto'g'ri" });
    if (!Number.isFinite(targetGroupId)) return res.status(400).json({ message: "Yangi guruh ID (targetGroupId) noto'g'ri yoki berilmagan" });
    if (oldGroupId === targetGroupId) return res.status(400).json({ message: "Bir xil guruhga ko'chirish mumkin emas" });

    const [oldGroup, newGroup] = await Promise.all([
      prisma.group.findFirst({ where: { id: oldGroupId, teacherId }, select: { id: true } }),
      prisma.group.findFirst({ where: { id: targetGroupId, teacherId }, select: { id: true, name: true } })
    ]);

    if (!oldGroup) return res.status(404).json({ message: "Joriy guruh topilmadi" });
    if (!newGroup) return res.status(404).json({ message: "Yangi maqsadli guruh topilmadi. U o'chirilgan bo'lishi mumkin." });

    const result = await prisma.student.updateMany({
      where: { groupId: oldGroupId, isDeleted: false },
      data: { groupId: targetGroupId }
    });

    return res.json({ message: `Jami ${result.count} ta o'quvchi "${newGroup.name}" guruhiga ko'chirildi` });
  } catch (err) {
    console.error("[GROUP BULK MOVE STUDENTS]", err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

// PUT /api/groups/:id
exports.EDIT = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "ID noto'g'ri" });

    const { name, subject, monthlyPrice, days, time, durationMin } = req.body;

    if (!name?.trim()) return res.status(400).json({ message: "Guruh nomi kerak" });
    if (monthlyPrice === undefined || monthlyPrice === null) return res.status(400).json({ message: "monthlyPrice kerak" });

    const weekdays = parseDays(days);
    if (weekdays.length > 0 && !time) return res.status(400).json({ message: "Kunlar tanlangan bo'lsa time ham kerak" });
    if (time && !/^\d{2}:\d{2}$/.test(time)) return res.status(400).json({ message: "time formati noto'g'ri (HH:MM)" });

    const dur = durationMin !== undefined ? Number(durationMin) : 90;
    if (durationMin !== undefined && (isNaN(dur) || dur < 30 || dur > 300)) {
       return res.status(400).json({ message: "durationMin noto'g'ri (30..300)" });
    }

    const exists = await prisma.group.findFirst({ where: { id, teacherId }, select: { id: true } });
    if (!exists) return res.status(404).json({ message: "Guruh topilmadi" });

    const updatedGroup = await prisma.$transaction(async (tx) => {
      // 1. Asosiy guruh malumotlarini yangilash
      const group = await tx.group.update({
        where: { id },
        data: {
          name: name.trim(),
          subject: subject?.trim() || null,
          monthlyPrice: String(monthlyPrice),
          days: Array.isArray(days) ? days : [],
          time: time || null
        }
      });

      // 2. Jadvalni qayta yaratish (agar kunlar yuborilgan bo'lsa)
      // Escaping schedule updates explicitly ensures clean overwrite instead of granular patches
      if (weekdays.length > 0 && time) {
        await tx.groupSchedule.deleteMany({ where: { groupId: id } });
        await tx.groupSchedule.createMany({
          data: weekdays.map((w) => ({
            groupId: id,
            weekday: w,
            startTime: time,
            durationMin: dur,
            isActive: true,
          })),
        });
      } else if (Array.isArray(days) && days.length === 0) {
        // Agar bo'sh kunlar massivi kelsa, jadvallarni o'chirib tashlaymiz
        await tx.groupSchedule.deleteMany({ where: { groupId: id } });
      }

      return group;
    });

    return res.json({ message: "Guruh muvaffaqiyatli tahrirlandi", group: updatedGroup });
  } catch (err) {
    console.error("[GROUP EDIT]", err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};