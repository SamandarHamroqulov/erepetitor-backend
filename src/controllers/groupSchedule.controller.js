    const prisma = require("../services/prismaClient");

// POST /api/group-schedules
// body: { groupId, weekday, startTime, durationMin? }
exports.CREATE = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const { groupId, weekday, startTime, durationMin } = req.body;

    if (!groupId) return res.status(400).json({ message: "groupId kerak" });
    if (!weekday) return res.status(400).json({ message: "weekday kerak" });
    if (!startTime) return res.status(400).json({ message: "startTime kerak (HH:MM)" });

    const gid = Number(groupId);
    if (Number.isNaN(gid)) return res.status(400).json({ message: "groupId noto'g'ri" });

    // weekday enum tekshirish
    const allowed = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
    if (!allowed.includes(weekday)) {
      return res.status(400).json({ message: "weekday noto'g'ri (MON..SUN)" });
    }

    // HH:MM format tekshirish
    if (!/^\d{2}:\d{2}$/.test(startTime)) {
      return res.status(400).json({ message: "startTime formati noto'g'ri (HH:MM)" });
    }
    const [h, m] = startTime.split(":").map(Number);
    if (h < 0 || h > 23 || m < 0 || m > 59) {
      return res.status(400).json({ message: "startTime noto'g'ri" });
    }

    const dur = durationMin !== undefined ? Number(durationMin) : 90;
    if (Number.isNaN(dur) || dur < 30 || dur > 300) {
      return res.status(400).json({ message: "durationMin noto'g'ri (30..300)" });
    }

    // group shu teacherga tegishlimi?
    const group = await prisma.group.findFirst({
      where: { id: gid, teacherId },
      select: { id: true },
    });
    if (!group) return res.status(404).json({ message: "Guruh topilmadi" });

    // Bir group + weekday uchun 1 ta schedule bo'lsin (xohlasa update qilinadi)
    const exists = await prisma.groupSchedule.findFirst({
      where: { groupId: gid, weekday },
      select: { id: true },
    });
    if (exists) {
      return res.status(409).json({ message: "Bu kunda schedule allaqachon bor" });
    }

    const schedule = await prisma.groupSchedule.create({
      data: {
        groupId: gid,
        weekday,
        startTime,
        durationMin: dur,
        isActive: true,
      },
      select: {
        id: true,
        groupId: true,
        weekday: true,
        startTime: true,
        durationMin: true,
        isActive: true,
        createdAt: true,
      },
    });

    return res.status(201).json({ message: "Schedule qo'shildi", schedule });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

// GET /api/group-schedules?groupId=1 (optional)
exports.LIST = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const groupId = req.query.groupId ? Number(req.query.groupId) : null;

    if (req.query.groupId && Number.isNaN(groupId)) {
      return res.status(400).json({ message: "groupId noto'g'ri" });
    }

    const items = await prisma.groupSchedule.findMany({
      where: {
        ...(groupId ? { groupId } : {}),
        group: { teacherId },
      },
      orderBy: [{ groupId: "asc" }, { weekday: "asc" }],
      select: {
        id: true,
        weekday: true,
        startTime: true,
        durationMin: true,
        isActive: true,
        group: { select: { id: true, name: true } },
      },
    });

    return res.json({ items });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

// PATCH /api/group-schedules/:id/toggle
exports.TOGGLE = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: "id noto'g'ri" });

    const found = await prisma.groupSchedule.findFirst({
      where: { id, group: { teacherId } },
      select: { id: true, isActive: true },
    });
    if (!found) return res.status(404).json({ message: "Schedule topilmadi" });

    const updated = await prisma.groupSchedule.update({
      where: { id },
      data: { isActive: !found.isActive },
      select: { id: true, isActive: true },
    });

    return res.json({ message: "OK", schedule: updated });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};

// DELETE /api/group-schedules/:id
exports.DELETE = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: "id noto'g'ri" });

    const found = await prisma.groupSchedule.findFirst({
      where: { id, group: { teacherId } },
      select: { id: true },
    });
    if (!found) return res.status(404).json({ message: "Schedule topilmadi" });

    await prisma.groupSchedule.delete({ where: { id } });
    return res.json({ message: "Schedule o'chirildi" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};