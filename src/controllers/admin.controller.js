const prisma = require("../services/prismaClient");
const { normalizeMonthYM } = require("../utils/month");

/**
 * GET /api/admin/stats?month=YYYY-MM-DD
 * Returns all dashboard data in one call.
 */
exports.STATS = async (req, res) => {
  try {
    const dateStr = req.query.date || new Date().toISOString().split("T")[0];
    const month = normalizeMonthYM(dateStr) || new Date().toISOString().slice(0, 7);
    const todayDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // ── Parallel queries ──────────────────────────────────────────────────
    const [
      totalTeachers,
      activeTeachers,
      totalGroups,
      totalStudents,
      activeStudents,
      deletedStudents,
      duePayments,
      paidPayments,
      dueAgg,
      paidAgg,
      todayPresent,
      todayAbsent,
      todayLate,
      teachers,
      groups,
    ] = await Promise.all([
      prisma.teacher.count(),
      prisma.teacher.count({ where: { isActive: true } }),
      prisma.group.count(),
      prisma.student.count({ where: { isDeleted: false } }),
      prisma.student.count({ where: { isActive: true, isDeleted: false } }),
      prisma.student.count({ where: { isDeleted: true } }),
      prisma.payment.count({ where: { month, status: "DUE" } }),
      prisma.payment.count({ where: { month, status: "PAID" } }),
      prisma.payment.aggregate({
        where: { month, status: "DUE" },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { month, status: "PAID" },
        _sum: { paidAmount: true },
      }),
      prisma.attendance.count({ where: { date: todayDate, status: "PRESENT" } }),
      prisma.attendance.count({ where: { date: todayDate, status: "ABSENT" } }),
      prisma.attendance.count({ where: { date: todayDate, status: "LATE" } }),
      // Teachers with counts
      prisma.teacher.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          _count: {
            select: {
              groups: true,
            },
          },
        },
      }),
      // Groups with teacher + student count
      prisma.group.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          subject: true,
          monthlyPrice: true,
          createdAt: true,
          teacher: { select: { id: true, name: true } },
          _count: {
            select: {
              students: {
                where: { isActive: true, isDeleted: false },
              },
            },
          },
        },
      }),
    ]);

    // Get student count per teacher
    const studentsPerTeacher = await prisma.student.groupBy({
      by: ["groupId"],
      where: { isDeleted: false, isActive: true, groupId: { not: null } },
      _count: { _all: true },
    });

    // Map groupId -> teacherId
    const groupTeacherMap = new Map();
    for (const g of groups) {
      groupTeacherMap.set(g.id, g.teacher.id);
    }

    // Accumulate students per teacher
    const teacherStudentCounts = new Map();
    for (const entry of studentsPerTeacher) {
      const tid = groupTeacherMap.get(entry.groupId);
      if (tid) {
        teacherStudentCounts.set(tid, (teacherStudentCounts.get(tid) || 0) + entry._count._all);
      }
    }

    const teacherList = teachers.map((t) => ({
      id: t.id,
      name: t.name,
      email: t.email,
      role: t.role,
      isActive: t.isActive,
      createdAt: t.createdAt,
      groupsCount: t._count.groups,
      studentsCount: teacherStudentCounts.get(t.id) || 0,
    }));

    const groupList = groups.map((g) => ({
      id: g.id,
      name: g.name,
      subject: g.subject,
      monthlyPrice: String(g.monthlyPrice),
      teacherName: g.teacher.name,
      teacherId: g.teacher.id,
      activeStudents: g._count.students,
      createdAt: g.createdAt,
    }));

    // Expected income = sum of all active students' fees
    const expectedAgg = await prisma.payment.aggregate({
      where: { month },
      _sum: { amount: true },
    });

    return res.json({
      month,
      overview: {
        totalTeachers,
        activeTeachers,
        totalGroups,
        totalStudents,
        activeStudents,
        deletedStudents,
      },
      payments: {
        month,
        dueCount: duePayments,
        paidCount: paidPayments,
        dueSum: String(dueAgg._sum.amount || 0),
        paidSum: String(paidAgg._sum.paidAmount || 0),
        expectedSum: String(expectedAgg._sum.amount || 0),
      },
      attendance: {
        date: todayDate,
        present: todayPresent,
        absent: todayAbsent,
        late: todayLate,
        total: todayPresent + todayAbsent + todayLate,
      },
      teachers: teacherList,
      groups: groupList,
    });
  } catch (err) {
    console.error("[ADMIN STATS]", err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};
