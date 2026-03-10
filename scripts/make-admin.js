#!/usr/bin/env node
/**
 * Set a teacher as ADMIN by email.
 * Usage: node scripts/make-admin.js admin@example.com
 * Run after: npx prisma migrate deploy
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
// Reuse the backend's Prisma initialization (uses @prisma/adapter-pg)
const prisma = require("../src/services/prismaClient");

async function main() {
  const email = process.argv[2]?.trim()?.toLowerCase();
  if (!email) {
    console.error("Usage: node scripts/make-admin.js <email>");
    process.exit(1);
  }

  const teacher = await prisma.teacher.update({
    where: { email },
    data: { role: "ADMIN" },
  });
  console.log(`✅ ${teacher.name} (${teacher.email}) is now ADMIN`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    if (e.code === "P2025") {
      console.error(`Teacher with email "${process.argv[2]}" not found.`);
    } else {
      console.error(e);
    }
    process.exit(1);
  });
