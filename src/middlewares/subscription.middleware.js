const prisma = require("../services/prismaClient");

module.exports = async function subscriptionGuard(req, res, next) {
  try {
    // ✅ bu routelar subscription tekshirmaydi (to'lov qilish uchun kerak)
    if (req.path.startsWith("/billing")) return next();

    const teacherId = req.user?.teacherId;
    if (!teacherId) return res.status(401).json({ message: "Unauthorized" });

    const sub = await prisma.subscription.findUnique({
      where: { teacherId },
      select: { currentPeriodEndsAt: true, status: true },
    });

    // fallback: eski userlarda subscription bo'lmasa
    if (!sub) {
      const now = new Date();
      const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

      await prisma.subscription.create({
        data: {
          teacherId,
          status: "TRIAL",
          trialEndsAt: trialEnd,
          currentPeriodEndsAt: trialEnd,
        },
      });

      return next();
    }

    const now = new Date();
    const endsAt = sub.currentPeriodEndsAt
      ? new Date(sub.currentPeriodEndsAt)
      : null;

    if (!endsAt || endsAt < now) {
      // optional: EXPIRED qilib qo'yamiz
      await prisma.subscription.update({
        where: { teacherId },
        data: { status: "EXPIRED" },
      });

      return res.status(402).json({
        message: "Obuna muddati tugagan. To'lov qiling.",
        code: "SUBSCRIPTION_EXPIRED",
        endsAt,
      });
    }

    return next();
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};