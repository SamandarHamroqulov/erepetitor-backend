const prisma = require("../services/prismaClient");
const { normalizeMonthYM } = require("../utils/month");

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

exports.MAIN = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;

    const dateStr = req.query.date || new Date().toISOString().split("T")[0];
    const month = normalizeMonthYM(dateStr);
    if (!month) return res.status(400).json({ message: "date noto'g'ri format (YYYY-MM-DD)" });

    const todayWeekday = WEEKDAYS[new Date().getDay()];
    const baseWhere = { month, student: { group: { teacherId } } };

    // ── Parallel queries ──────────────────────────────────────────────────────
    const [
      totalStudents,
      activeStudents,
      dueCount,
      paidCount,
      dueAgg,
      paidAgg,
      activeGroups,
      groups,
      todaySchedules,
    ] = await Promise.all([
      prisma.student.count({
        where: { group: { teacherId } },
      }),
      prisma.student.count({
        where: { isActive: true, group: { teacherId } },
      }),
      prisma.payment.count({
        where: { ...baseWhere, status: "DUE" },
      }),
      prisma.payment.count({
        where: { ...baseWhere, status: "PAID" },
      }),
      prisma.payment.aggregate({
        where: { ...baseWhere, status: "DUE" },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { ...baseWhere, status: "PAID" },
        _sum: { amount: true },
      }),
      prisma.group.count({
        where: { teacherId, schedules: { some: { isActive: true } } },
      }),
      prisma.group.findMany({
        where: { teacherId },
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true },
      }),
      prisma.groupSchedule.findMany({
        where: { isActive: true, weekday: todayWeekday, group: { teacherId } },
        orderBy: { startTime: "asc" },
        select: {
          groupId: true,
          startTime: true,
          durationMin: true,
          group: { select: { name: true } },
        },
      }),
    ]);

    // ── Per-group active student counts ───────────────────────────────────────
    const groupIds = groups.map((g) => g.id);

    const perGroup =
      groupIds.length > 0
        ? await prisma.student.groupBy({
            by: ["groupId"],
            where: { groupId: { in: groupIds }, isActive: true },
            _count: { _all: true },
          })
        : [];

    const perGroupMap = new Map(perGroup.map((x) => [x.groupId, x._count._all]));

    const groupCards = groups.map((g) => ({
      id: g.id,
      name: g.name,
      activeStudents: perGroupMap.get(g.id) ?? 0,
    }));

    // ── Today's schedule grouped by group ────────────────────────────────────
    const byGroup = new Map();
    for (const s of todaySchedules) {
      if (!byGroup.has(s.groupId)) {
        byGroup.set(s.groupId, {
          groupId: s.groupId,
          groupName: s.group.name,
          lessons: [],
        });
      }
      byGroup.get(s.groupId).lessons.push({
        startTime: s.startTime,
        durationMin: s.durationMin,
      });
    }

    const todayScheduleGroups = Array.from(byGroup.values());
    const todayLessons = todaySchedules.length;
    const todayGroups = byGroup.size;

    const dueSum = dueAgg._sum.amount ?? 0;
    const paidSum = paidAgg._sum.amount ?? 0;

    // ── Recent payments (PAID this month, top 10 by paidAt) ───────────────────
    const recentPayments = await prisma.payment.findMany({
      where: { ...baseWhere, status: "PAID" },
      orderBy: { paidAt: "desc" },
      take: 10,
      include: {
        student: {
          select: { id: true, name: true, group: { select: { name: true } } },
        },
      },
    });

    // ── Debtors preview (DUE this month, top 10) ──────────────────────────────
    const debtorsPreview = await prisma.payment.findMany({
      where: { ...baseWhere, status: "DUE" },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        student: {
          select: { id: true, name: true, parentPhone: true, group: { select: { name: true } } },
        },
      },
    });

    const formatPayment = (p) => ({
      ...p,
      amount: String(p.amount),
      paidAmount: String(p.paidAmount || 0),
      remaining: String(Math.max(0, Number(p.amount) - Number(p.paidAmount || 0))),
    });

    return res.json({
      month,
      students: {
        total: totalStudents,
        active: activeStudents,
      },
      payments: {
        month,
        dueCount,
        paidCount,
        dueSum: String(dueSum),
        paidSum: String(paidSum),
      },
      groups: {
        total: groups.length,
        active: activeGroups,
        cards: groupCards,
      },
      today: {
        weekday: todayWeekday,
        lessonCount: todayLessons,
        groupCount: todayGroups,
        scheduleGroups: todayScheduleGroups,
      },
      recentPayments: recentPayments.map(formatPayment),
      debtorsPreview: debtorsPreview.map(formatPayment),
    });
  } catch (err) {
    console.error("[DASHBOARD MAIN]", err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};