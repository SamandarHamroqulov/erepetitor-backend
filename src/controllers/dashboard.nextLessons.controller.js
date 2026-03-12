const prisma = require("../services/prismaClient");

const WEEKDAY_INDEX = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };

function parseHHMM(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return { h, m };
}

function nextOccurrence(fromDate, weekdayEnum, startTime) {
  // fromDate: Date (local)
  // weekdayEnum: "MON"..."SUN"
  // startTime: "HH:MM"
  const targetDow = WEEKDAY_INDEX[weekdayEnum]; // 0..6 (Sun..Sat)
  const { h, m } = parseHHMM(startTime);

  const d = new Date(fromDate);
  d.setSeconds(0, 0);

  const currentDow = d.getDay();
  let diff = (targetDow - currentDow + 7) % 7;

  // candidate date (same week)
  const candidate = new Date(d);
  candidate.setDate(d.getDate() + diff);
  candidate.setHours(h, m, 0, 0);

  // agar bugun bo‘lsa, vaqt o‘tib ketgan bo‘lsa -> keyingi hafta
  if (diff === 0 && candidate <= d) {
    candidate.setDate(candidate.getDate() + 7);
  }

  return candidate;
}

// GET /api/dashboard/next-lessons?from=ISO(optional)&limit=10(optional)
exports.NEXT_LESSONS = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;

    const from = req.query.from ? new Date(req.query.from) : new Date();
    if (isNaN(from.getTime())) return res.status(400).json({ message: "from noto'g'ri (ISO bo'lsin)" });

    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));

    const schedules = await prisma.groupSchedule.findMany({
      where: { isActive: true, group: { teacherId } },
      include: {
        group: { select: { id: true, name: true } },
      },
    });

    const items = schedules.map((s) => {
      const nextAt = nextOccurrence(from, s.weekday, s.startTime);
      const endAt = new Date(nextAt.getTime() + s.durationMin * 60 * 1000);

      return {
        groupId: s.group.id,
        groupName: s.group.name,
        weekday: s.weekday,
        startTime: s.startTime,
        durationMin: s.durationMin,
        nextAt: nextAt.toISOString(),
        endAt: endAt.toISOString(),
      };
    });

    items.sort((a, b) => new Date(a.nextAt) - new Date(b.nextAt));

    return res.json({ from: from.toISOString(), items: items.slice(0, limit) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};