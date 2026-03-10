-- CreateEnum
CREATE TYPE "TeacherRole" AS ENUM ('TEACHER', 'ADMIN');

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN "role" "TeacherRole" NOT NULL DEFAULT 'TEACHER';
