import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readdir, unlink } from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();

async function main() {
  console.log("→ Удаляю весь контент и пользователей...");

  await prisma.$transaction(async (tx) => {
    await tx.answerAttempt.deleteMany();
    await tx.testAttempt.deleteMany();
    await tx.question.deleteMany();
    await tx.test.deleteMany();
    await tx.lessonAttachment.deleteMany();
    await tx.lessonProgress.deleteMany();
    await tx.lesson.deleteMany();
    await tx.courseAccess.deleteMany();
    await tx.enrollment.deleteMany();
    await tx.course.deleteMany();
    await tx.user.deleteMany();
  });

  const avatarsDir = path.join(process.cwd(), "public", "uploads", "avatars");
  try {
    const files = await readdir(avatarsDir);
    let removed = 0;
    for (const file of files) {
      if (file === ".gitkeep") continue;
      await unlink(path.join(avatarsDir, file));
      removed++;
    }
    console.log(`✓ Очищено файлов аватаров: ${removed}`);
  } catch {
    console.log("ℹ Папка аватаров не найдена или пуста — пропускаю.");
  }

  const passwordHash = await bcrypt.hash("Inputoutput", 10);
  const admin = await prisma.user.create({
    data: {
      email: "ditecs@yandex.ru",
      passwordHash,
      firstName: "Админ",
      lastName: "Портала",
      role: "ADMIN",
      status: "ACTIVE"
    }
  });

  console.log(`✓ Создан админ: ${admin.email} (${admin.id})`);

  const deptCount = await prisma.department.count();
  const userCount = await prisma.user.count();
  console.log("\nИтого:");
  console.log(`  Departments: ${deptCount}`);
  console.log(`  Users: ${userCount}`);
  console.log("  Курсы/уроки/тесты: 0");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
