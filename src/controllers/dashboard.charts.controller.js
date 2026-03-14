const prisma = require("../services/prismaClient");
const { normalizeMonthYM } = require("../utils/month");

// Oxirgi N oy uchun YYYY-MM-DD formatida massiv qaytaradi
function lastNMonths(n) {
  const months = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    months.push(`${y}-${m}-01`);
  }
  return months;
}

// GET /api/dashboard/charts?months=6
exports.CHARTS = async (req, res) => {
  try {
    const teacherId = req.user.teacherId;
    const monthCount = Math.min(parseInt(req.query.months) || 6, 12);
    const months = lastNMonths(monthCount);

    // 1) Oylik daromad — har oy PAID bo'lgan summalar yig'indisi
    const revenueRaw = await prisma.payment.groupBy({
      by: ["month"],
      where: {
        month: { in: months },
        paidAmount: { gt: 0 },
        student: { group: { teacherId } },
      },
      _sum: { paidAmount: true },
    });

    const revenueMap = new Map(
      revenueRaw.map((r) => [r.month, Number(r._sum.paidAmount ?? 0)])
    );

    const revenueChart = months.map((m) => ({
      month: m,
      amount: revenueMap.get(m) ?? 0,
    }));

    // 2) To'lov holati — joriy oy uchun donut
    const currentMonth = normalizeMonthYM(new Date().toISOString().split("T")[0]);
    const [paidCount, partialCount, dueCount] = await Promise.all([
      prisma.payment.count({
        where: { month: currentMonth, status: "PAID", student: { group: { teacherId } } },
      }),
      prisma.payment.count({
        where: { month: currentMonth, status: "PARTIAL", student: { group: { teacherId } } },
      }),
      prisma.payment.count({
        where: { month: currentMonth, status: "DUE", student: { group: { teacherId } } },
      }),
    ]);

    const paymentStatus = [
      { label: "To'langan", value: paidCount, color: "#10b981" },
      { label: "Qisman", value: partialCount, color: "#f59e0b" },
      { label: "Qarzdor", value: dueCount, color: "#f43f5e" },
    ];

    // 3) Guruh bo'yicha o'quvchilar soni
    const groupStats = await prisma.group.findMany({
      where: { teacherId },
      select: {
        id: true,
        name: true,
        _count: { select: { students: { where: { isActive: true } } } },
      },
      orderBy: { createdAt: "asc" },
    });

    const groupChart = groupStats.map((g) => ({
      name: g.name.length > 12 ? g.name.slice(0, 12) + "…" : g.name,
      students: g._count.students,
    }));

    // 4) O'quvchilar o'sishi — har oy qo'shilgan o'quvchilar
    const studentGrowthRaw = await prisma.student.findMany({
      where: {
        group: { teacherId },
        createdAt: { gte: new Date(months[0]) },
      },
      select: { createdAt: true },
    });

    const growthMap = new Map();
    for (const m of months) growthMap.set(m, 0);
    for (const s of studentGrowthRaw) {
      const d = s.createdAt;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
      if (growthMap.has(key)) growthMap.set(key, growthMap.get(key) + 1);
    }

    const studentGrowth = months.map((m) => ({
      month: m,
      count: growthMap.get(m) ?? 0,
    }));

    return res.json({
      revenueChart,
      paymentStatus,
      groupChart,
      studentGrowth,
      currentMonth,
    });
  } catch (err) {
    console.error("[DASHBOARD CHARTS]", err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};
