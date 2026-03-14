const prisma = require("../services/prismaClient");

const WEEKDAY_MAP = {
  0: "SUN", 1: "MON", 2: "TUE", 3: "WED",
  4: "THU", 5: "FRI", 6: "SAT",
};

/**
 * GET /api/dashboard/attendance-reminder
 * Bugun dars bo'lgan guruhlardan qaysi birida davomat belgilanmaganini qaytaradi.
 */
exports.ATTENDANCE_REMINDER = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const now = new Date();
    const todayWeekday = WEEKDAY_MAP[now.getDay()];
    const todayStr = now.toISOString().slice(0, 10); // "YYYY-MM-DD"

    // Bugun dars bo'lgan faol guruhlar
    const todaySchedules = await prisma.groupSchedule.findMany({
      where: {
        weekday: todayWeekday,
        isActive: true,
        group: { teacherId },
      },
      select: {
        groupId: true,
        startTime: true,
        group: {
          select: {
            id: true,
            name: true,
            students: {
              where: { isActive: true, isDeleted: false },
              select: { id: true },
            },
          },
        },
      },
    });

    if (todaySchedules.length === 0) {
      return res.json({ reminders: [], todayWeekday, todayStr });
    }

    // Har guruh uchun bugun davomat belgilanganmi tekshir
    const groupIds = [...new Set(todaySchedules.map((s) => s.groupId))];

    const attendanceCounts = await prisma.attendance.groupBy({
      by: ["groupId"],
      where: {
        groupId: { in: groupIds },
        date: todayStr,
      },
      _count: { _all: true },
    });

    const markedMap = new Map(
      attendanceCounts.map((a) => [a.groupId, a._count._all])
    );

    // Guruhlarni birlashtir (bir guruh bir nechta jadvalda bo'lishi mumkin)
    const groupMap = new Map();
    for (const s of todaySchedules) {
      if (!groupMap.has(s.groupId)) {
        groupMap.set(s.groupId, {
          groupId: s.groupId,
          groupName: s.group.name,
          startTime: s.startTime,
          studentCount: s.group.students.length,
          markedCount: markedMap.get(s.groupId) ?? 0,
        });
      }
    }

    // Faqat davomat belgilanmagan yoki to'liq belgilanmagan guruhlar
    const reminders = Array.from(groupMap.values())
      .filter((g) => g.studentCount > 0 && g.markedCount < g.studentCount)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    return res.json({ reminders, todayWeekday, todayStr });
  } catch (err) {
    console.error("[ATTENDANCE REMINDER]", err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};
