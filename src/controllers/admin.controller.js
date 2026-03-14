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
      pendingBilling
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
      prisma.billingPayment.count({ where: { status: "PENDING" } })
    ]);

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
      billing: {
        pendingRequests: pendingBilling
      }
    });
  } catch (err) {
    console.error("[ADMIN STATS]", err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};
