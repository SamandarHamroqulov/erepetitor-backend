const prisma = require("../services/prismaClient");

const VALID_STATUSES = ["PRESENT", "ABSENT", "LATE"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/groups/:id/attendance?date=YYYY-MM-DD
 */
exports.GET_ATTENDANCE = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const groupId = Number(req.params.id);
    const date = req.query.date; // YYYY-MM-DD

    if (!date) return res.status(400).json({ message: "Sana (date) kerak" });
    if (!DATE_RE.test(date)) return res.status(400).json({ message: "date formati noto'g'ri (YYYY-MM-DD)" });

    // Validate if the group belongs to this teacher
    const group = await prisma.group.findFirst({
      where: { id: groupId, teacherId }
    });
    if (!group) return res.status(404).json({ message: "Guruh topilmadi" });

    const attendance = await prisma.attendance.findMany({
      where: { groupId, date },
      select: { id: true, studentId: true, status: true }
    });

    return res.json({ attendance });
  } catch (err) {
    console.error("[ATTENDANCE GET]", err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

/**
 * POST /api/groups/:id/attendance
 * body: { studentId: 1, date: "2026-05-12", status: "PRESENT"|"ABSENT"|"LATE" }
 */
exports.MARK_ATTENDANCE = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const groupId = Number(req.params.id);
    const { studentId, date, status } = req.body;

    if (!studentId || !date || !status) {
      return res.status(400).json({ message: "studentId, date va status kerak" });
    }

    if (!DATE_RE.test(date)) return res.status(400).json({ message: "date formati noto'g'ri (YYYY-MM-DD)" });

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: "Noto'g'ri status" });
    }

    // Verify group ownership and student belongs to this group
    const student = await prisma.student.findFirst({
      where: { id: Number(studentId), groupId, group: { teacherId } }
    });

    if (!student) {
      return res.status(404).json({ message: "Guruh yoki o'quvchi topilmadi" });
    }

    // Upsert attendance
    const record = await prisma.attendance.upsert({
      where: {
        studentId_groupId_date: {
          studentId: Number(studentId),
          groupId,
          date
        }
      },
      update: { status },
      create: {
        studentId: Number(studentId),
        groupId,
        date,
        status
      }
    });

    return res.json({ message: "Saqlandi", record });
  } catch (err) {
    console.error("[ATTENDANCE MARK]", err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

/**
 * PUT /api/groups/:id/attendance
 * body: { date: "2026-05-12", records: [{ studentId: 1, status: "PRESENT" }, ...] }
 * Bulk upsert attendance for all students in one request.
 * After saving, sends Telegram notification to parents of ABSENT students.
 */
exports.BULK_MARK = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const groupId = Number(req.params.id);
    const { date, records } = req.body;

    if (!date) return res.status(400).json({ message: "date kerak" });
    if (!DATE_RE.test(date)) return res.status(400).json({ message: "date formati noto'g'ri (YYYY-MM-DD)" });
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ message: "records massivi kerak" });
    }

    // Validate all statuses
    for (const r of records) {
      if (!r.studentId || !VALID_STATUSES.includes(r.status)) {
        return res.status(400).json({ message: `Noto'g'ri yozuv: studentId=${r.studentId}, status=${r.status}` });
      }
    }

    // Verify group ownership and get group name
    const group = await prisma.group.findFirst({
      where: { id: groupId, teacherId },
      select: { id: true, name: true },
    });
    if (!group) return res.status(404).json({ message: "Guruh topilmadi" });

    // Bulk upsert in a transaction
    const results = await prisma.$transaction(
      records.map((r) =>
        prisma.attendance.upsert({
          where: {
            studentId_groupId_date: {
              studentId: Number(r.studentId),
              groupId,
              date,
            },
          },
          update: { status: r.status },
          create: {
            studentId: Number(r.studentId),
            groupId,
            date,
            status: r.status,
          },
        })
      )
    );

    // ── Send Telegram notifications for ABSENT students (fire-and-forget) ──
    const absentStudentIds = records
      .filter((r) => r.status === "ABSENT")
      .map((r) => Number(r.studentId));

    if (absentStudentIds.length > 0) {
      // Run async, don't block the response
      notifyAbsentParents(req.app, teacherId, group.name, date, absentStudentIds).catch((e) =>
        console.error("[ATTENDANCE NOTIFY]", e?.message || e)
      );
    }

    return res.json({ message: "Davomat saqlandi", count: results.length });
  } catch (err) {
    console.error("[ATTENDANCE BULK]", err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

/**
 * Fire-and-forget: send Telegram messages to parents of absent students.
 */
async function notifyAbsentParents(app, teacherId, groupName, date, studentIds) {
  const bot = app.get("telegramBot");
  if (!bot) return; // No bot configured

  // Get absent students with parent phones
  const students = await prisma.student.findMany({
    where: { id: { in: studentIds }, parentPhone: { not: null } },
    select: { id: true, name: true, parentPhone: true },
  });

  for (const student of students) {
    if (!student.parentPhone) continue;

    try {
      const link = await prisma.telegramLink.findUnique({
        where: { teacherId_phone: { teacherId, phone: student.parentPhone } },
        select: { chatId: true },
      });
      if (!link) continue;

      const text =
        `📋 Davomat xabari\n` +
        `Guruh: ${groupName}\n` +
        `O'quvchi: ${student.name}\n` +
        `Sana: ${date}\n\n` +
        `❌ Farzandingiz bugungi darsga kelmadi.`;

      await bot.telegram.sendMessage(link.chatId, text);
    } catch (e) {
      console.error(`[TG ABSENT NOTIFY] student=${student.id}`, e?.message || e);
    }
  }
}
