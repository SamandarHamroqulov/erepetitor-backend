const prisma = require("../services/prismaClient");

/**
 * Admin middleware — checks if the authenticated user has ADMIN role.
 * Must be placed AFTER auth.middleware.
 */
module.exports = async (req, res, next) => {
  try {
    const teacherId = req.user?.teacherId;
    if (!teacherId) {
      return res.status(401).json({ message: "Autentifikatsiya kerak" });
    }

    // Check role from DB
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { id: true, role: true },
    });

    if (!teacher || teacher.role !== "ADMIN") {
      // Fallback: x-admin-token header
      const token = req.headers["x-admin-token"];
      if (process.env.ADMIN_TOKEN && token === process.env.ADMIN_TOKEN) {
        return next();
      }
      return res.status(403).json({ message: "Admin huquqi yo'q" });
    }

    next();
  } catch (err) {
    console.error("[ADMIN MIDDLEWARE]", err);
    return res.status(500).json({ message: "Server xatoligi" });
  }
};
