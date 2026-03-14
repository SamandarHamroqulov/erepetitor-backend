const prisma = require("../services/prismaClient");

/**
 * GET /api/groups/:id/attendance/monthly-stats?month=YYYY-MM
 * Returns per-student attendance summary for the given month.
 */
exports.MONTHLY_STATS = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const groupId = Number(req.params.id);
    const monthParam = req.query.month; // "YYYY-MM"

    if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
      return res.status(400).json({ message: "month parametri kerak (YYYY-MM)" });
    }

    // Verify ownership
    const group = await prisma.group.findFirst({
      where: { id: groupId, teacherId },
      select: { id: true, name: true },
    });
    if (!group) return res.status(404).json({ message: "Guruh topilmadi" });

    // Date range for the month
    const [year, mon] = monthParam.split("-").map(Number);
    const startDate = `${monthParam}-01`;
    const lastDay = new Date(year, mon, 0).getDate();
    const endDate = `${monthParam}-${String(lastDay).padStart(2, "0")}`;

    // Get all attendance records for this group in this month
    const records = await prisma.attendance.findMany({
      where: {
        groupId,
        date: { gte: startDate, lte: endDate },
        student: { isActive: true, isDeleted: false },
      },
      select: {
        studentId: true,
        date: true,
        status: true,
        student: { select: { id: true, name: true, parentPhone: true } },
      },
      orderBy: { date: "asc" },
    });

    // Group by student
    const studentMap = new Map();
    for (const r of records) {
      const sid = r.studentId;
      if (!studentMap.has(sid)) {
        studentMap.set(sid, {
          studentId: sid,
          name: r.student.name,
          parentPhone: r.student.parentPhone,
          present: 0,
          absent: 0,
          late: 0,
          dates: [],
        });
      }
      const entry = studentMap.get(sid);
      if (r.status === "PRESENT") entry.present++;
      else if (r.status === "ABSENT") entry.absent++;
      else if (r.status === "LATE") entry.late++;
      entry.dates.push({ date: r.date, status: r.status });
    }

    // Get unique lesson dates this month (distinct dates that have any attendance)
    const uniqueDates = [...new Set(records.map((r) => r.date))].sort();
    const totalLessons = uniqueDates.length;

    // Build per-student stats
    const stats = Array.from(studentMap.values()).map((s) => {
      const attended = s.present + s.late; // late counts as attended
      const attendanceRate = totalLessons > 0
        ? Math.round((attended / totalLessons) * 100)
        : null;
      return {
        ...s,
        totalLessons,
        attended,
        attendanceRate,
        // Flag students with < 70% attendance
        lowAttendance: attendanceRate !== null && attendanceRate < 70,
      };
    });

    // Sort: low attendance first, then by name
    stats.sort((a, b) => {
      if (a.lowAttendance && !b.lowAttendance) return -1;
      if (!a.lowAttendance && b.lowAttendance) return 1;
      return a.name.localeCompare(b.name);
    });

    // Group-level summary
    const groupPresent = stats.reduce((s, x) => s + x.present, 0);
    const groupAbsent = stats.reduce((s, x) => s + x.absent, 0);
    const groupLate = stats.reduce((s, x) => s + x.late, 0);

    return res.json({
      month: monthParam,
      groupId,
      totalLessons,
      uniqueDates,
      summary: {
        present: groupPresent,
        absent: groupAbsent,
        late: groupLate,
        total: groupPresent + groupAbsent + groupLate,
      },
      students: stats,
    });
  } catch (err) {
    console.error("[ATTENDANCE MONTHLY STATS]", err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};
