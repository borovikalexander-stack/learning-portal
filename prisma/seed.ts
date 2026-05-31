import { PrismaClient, CourseStatus, QuestionType, UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("portal12345", 10);

  const auto = await prisma.department.upsert({
    where: { slug: "autopodbor" },
    update: {},
    create: {
      slug: "autopodbor",
      name: "Автоподбор",
      description: "Курсы для менеджеров направления автоподбора."
    }
  });

  const importDept = await prisma.department.upsert({
    where: { slug: "import" },
    update: {},
    create: {
      slug: "import",
      name: "Импорт",
      description: "Курсы для менеджеров направления импорта автомобилей."
    }
  });

  await prisma.department.upsert({
    where: { slug: "soprovozhdenie" },
    update: {},
    create: {
      slug: "soprovozhdenie",
      name: "Сопровождение",
      description: "Курсы для менеджеров сопровождения клиентов."
    }
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@company.ru" },
    update: {},
    create: {
      email: "admin@company.ru",
      passwordHash,
      firstName: "Админ",
      lastName: "Портала",
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE
    }
  });

  const manager = await prisma.user.upsert({
    where: { email: "alex@company.ru" },
    update: {},
    create: {
      email: "alex@company.ru",
      passwordHash,
      firstName: "Алексей",
      lastName: "Петров",
      role: UserRole.MANAGER,
      status: UserStatus.ACTIVE,
      departmentId: auto.id
    }
  });

  const pending = await prisma.user.upsert({
    where: { email: "ivan@company.ru" },
    update: {},
    create: {
      email: "ivan@company.ru",
      passwordHash,
      firstName: "Иван",
      lastName: "Новиков",
      role: UserRole.MANAGER,
      status: UserStatus.PENDING,
      requestedDept: "import"
    }
  });

  const objections = await prisma.course.upsert({
    where: { slug: "objections-auto" },
    update: {},
    create: {
      slug: "objections-auto",
      title: "Работа с возражениями в автоподборе",
      description: "Как переводить сомнения клиента в понятный следующий шаг.",
      departmentId: auto.id,
      status: CourseStatus.PUBLISHED,
      estimatedMins: 110,
      accent: "#0066CC",
      lessons: {
        create: [
          {
            title: "Типовые сомнения клиента",
            order: 1,
            durationMins: 18,
            kinescopeId: "demo-auto-01",
            markdown: "Разбираем страхи по цене, срокам, прозрачности и гарантиям."
          },
          {
            title: "Скрипт мягкого перефразирования",
            order: 2,
            durationMins: 24,
            kinescopeId: "demo-auto-02",
            markdown: "Техника: согласиться, уточнить, перевести разговор к ценности."
          }
        ]
      }
    }
  });

  const importBasics = await prisma.course.upsert({
    where: { slug: "import-basics" },
    update: {},
    create: {
      slug: "import-basics",
      title: "Основы импорта автомобилей",
      description: "Этапы сделки, документы, риски и коммуникация с клиентом.",
      departmentId: importDept.id,
      status: CourseStatus.PUBLISHED,
      estimatedMins: 140,
      accent: "#00A693",
      lessons: {
        create: [
          {
            title: "Маршрут импортной сделки",
            order: 1,
            durationMins: 20,
            kinescopeId: "demo-import-01",
            markdown: "От заявки до передачи автомобиля клиенту."
          }
        ]
      }
    }
  });

  const test = await prisma.test.upsert({
    where: { id: "seed-test-objections-auto" },
    update: {},
    create: {
      id: "seed-test-objections-auto",
      courseId: objections.id,
      title: "Итоговый тест по возражениям",
      passPercent: 70,
      maxAttempts: 2,
      questions: {
        create: [
          {
            type: QuestionType.SINGLE_CHOICE,
            order: 1,
            prompt: "Что сделать первым, когда клиент говорит 'дорого'?",
            options: ["Сразу дать скидку", "Согласиться и уточнить контекст", "Закрыть сделку давлением"],
            answerKey: ["Согласиться и уточнить контекст"]
          },
          {
            type: QuestionType.TEXT,
            order: 2,
            prompt: "Напишите короткий ответ клиенту, который сомневается в цене.",
            options: []
          }
        ]
      }
    }
  });

  await prisma.courseAccess.upsert({
    where: { userId_courseId: { userId: manager.id, courseId: objections.id } },
    update: {},
    create: {
      userId: manager.id,
      courseId: objections.id,
      source: "DEPARTMENT_DEFAULT",
      grantedBy: admin.id
    }
  });

  await prisma.courseAccess.upsert({
    where: { userId_courseId: { userId: manager.id, courseId: importBasics.id } },
    update: {},
    create: {
      userId: manager.id,
      courseId: importBasics.id,
      source: "MANUAL_GRANT",
      grantedBy: admin.id
    }
  });

  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: manager.id, courseId: objections.id } },
    update: { progress: 62 },
    create: {
      userId: manager.id,
      courseId: objections.id,
      progress: 62
    }
  });

  console.log({ admin: admin.email, manager: manager.email, pending: pending.email, test: test.title });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
