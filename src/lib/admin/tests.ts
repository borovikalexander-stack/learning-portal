"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

const questionTypes = ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TEXT", "MATCHING"] as const;

const testSchema = z.object({
  title: z.string().trim().min(1),
  passPercent: z.coerce.number().int().min(0).max(100).default(70),
  maxAttempts: z.coerce.number().int().min(1).max(10).default(2),
  timeLimitMins: z.preprocess((value) => {
    if (value === "" || value === null || value === undefined) {
      return null;
    }

    return value;
  }, z.coerce.number().int().min(1).max(240).nullable().optional())
});

const questionSchema = z.object({
  type: z.enum(questionTypes),
  prompt: z.string().trim().min(1),
  points: z.coerce.number().int().min(1).max(10).default(1)
});

function parseTestForm(formData: FormData) {
  return testSchema.parse({
    title: formData.get("title") || "Итоговый тест",
    passPercent: formData.get("passPercent") || 70,
    maxAttempts: formData.get("maxAttempts") || 2,
    timeLimitMins: formData.get("timeLimitMins")
  });
}

function trimList(values: FormDataEntryValue[]) {
  return values.map((value) => String(value).trim()).filter(Boolean);
}

function parseIndex(value: FormDataEntryValue | null, label: string) {
  const index = Number(value);

  if (!Number.isInteger(index)) {
    throw new Error(label);
  }

  return index;
}

function ensureInRange(index: number, max: number, label: string) {
  if (index < 0 || index > max) {
    throw new Error(label);
  }
}

function parseQuestionForm(formData: FormData) {
  const base = questionSchema.parse({
    type: formData.get("type"),
    prompt: formData.get("prompt"),
    points: formData.get("points") || 1
  });

  if (base.type === "TEXT") {
    return { ...base, options: Prisma.DbNull, answerKey: Prisma.DbNull };
  }

  if (base.type === "SINGLE_CHOICE" || base.type === "MULTIPLE_CHOICE") {
    const options = trimList(formData.getAll("option"));

    if (options.length < 2) {
      throw new Error("Добавьте минимум два варианта ответа");
    }

    if (base.type === "SINGLE_CHOICE") {
      const correctIndex = parseIndex(formData.get("correctIndex"), "Выберите правильный вариант");
      ensureInRange(correctIndex, options.length - 1, "Правильный вариант вне диапазона");

      return { ...base, options, answerKey: { correctIndex } };
    }

    const correctIndices = formData
      .getAll("correctIndices")
      .map((value) => parseIndex(value, "Некорректный индекс правильного ответа"));

    if (correctIndices.length === 0) {
      throw new Error("Выберите минимум один правильный вариант");
    }

    const uniqueCorrectIndices = Array.from(new Set(correctIndices)).sort((a, b) => a - b);
    uniqueCorrectIndices.forEach((index) => ensureInRange(index, options.length - 1, "Правильный вариант вне диапазона"));

    return { ...base, options, answerKey: { correctIndices: uniqueCorrectIndices } };
  }

  const left = trimList(formData.getAll("leftItem"));
  const right = trimList(formData.getAll("rightItem"));

  if (left.length < 2 || right.length < 2 || left.length !== right.length) {
    throw new Error("Для сопоставления нужно минимум две равные пары");
  }

  const pairs: Record<string, number> = {};

  for (const rawPair of formData.getAll("pair")) {
    const [leftRaw, rightRaw] = String(rawPair).split(":");
    const leftIndex = Number(leftRaw);
    const rightIndex = Number(rightRaw);

    if (!Number.isInteger(leftIndex) || !Number.isInteger(rightIndex)) {
      throw new Error("Некорректная пара сопоставления");
    }

    ensureInRange(leftIndex, left.length - 1, "Левая часть пары вне диапазона");
    ensureInRange(rightIndex, right.length - 1, "Правая часть пары вне диапазона");
    pairs[String(leftIndex)] = rightIndex;
  }

  if (Object.keys(pairs).length !== left.length) {
    throw new Error("Укажите правильную пару для каждого пункта");
  }

  return { ...base, options: { left, right }, answerKey: { pairs } };
}

async function getTestContext(testId: string) {
  return prisma.test.findUnique({
    where: { id: testId },
    select: { courseId: true, lessonId: true }
  });
}

async function getQuestionContext(questionId: string) {
  return prisma.question.findUnique({
    where: { id: questionId },
    select: {
      testId: true,
      test: {
        select: { courseId: true, lessonId: true }
      }
    }
  });
}

async function assertNoAttempts(testId: string): Promise<void> {
  const count = await prisma.testAttempt.count({ where: { testId } });

  if (count > 0) {
    throw new Error("Тест уже сдавали — структура заблокирована. Чтобы внести изменения, удалите тест полностью или попытки менеджеров.");
  }
}

function revalidateTestEditor(courseId: string, lessonId?: string | null) {
  revalidatePath(`/admin/courses/${courseId}`);

  if (lessonId) {
    revalidatePath(`/admin/courses/${courseId}/lessons/${lessonId}`);
    revalidatePath(`/admin/courses/${courseId}/lessons/${lessonId}/test`);
    return;
  }

  revalidatePath(`/admin/courses/${courseId}/test`);
}

export async function createTestAction(formData: FormData) {
  await requireAdmin();

  const courseId = String(formData.get("courseId") ?? "");
  const lessonId = String(formData.get("lessonId") ?? "").trim() || null;

  if (!courseId) {
    return;
  }

  if (lessonId) {
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { courseId: true }
    });

    if (!lesson || lesson.courseId !== courseId) {
      throw new Error("Урок не найден");
    }

    const existingLessonTest = await prisma.test.findUnique({
      where: { lessonId },
      select: { id: true }
    });

    if (existingLessonTest) {
      throw new Error("У этого урока уже есть тест");
    }
  } else {
    const existingFinalTest = await prisma.test.findFirst({
      where: { courseId, lessonId: null },
      select: { id: true }
    });

    if (existingFinalTest) {
      throw new Error("У этого курса уже есть итоговый тест");
    }
  }

  await prisma.test.create({
    data: {
      courseId,
      lessonId,
      ...parseTestForm(formData)
    }
  });

  revalidateTestEditor(courseId, lessonId);
}

export async function updateTestAction(formData: FormData) {
  await requireAdmin();

  const testId = String(formData.get("testId") ?? "");

  if (!testId) {
    return;
  }

  const context = await getTestContext(testId);

  if (!context) {
    return;
  }

  await assertNoAttempts(testId);

  const test = await prisma.test.update({
    where: { id: testId },
    data: parseTestForm(formData),
    select: { courseId: true, lessonId: true }
  });

  revalidateTestEditor(test.courseId, test.lessonId);
}

export async function deleteTestAction(formData: FormData) {
  await requireAdmin();

  const testId = String(formData.get("testId") ?? "");

  if (!testId) {
    return;
  }

  const context = await getTestContext(testId);

  if (!context) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.answerAttempt.deleteMany({ where: { question: { testId } } });
    await tx.testAttempt.deleteMany({ where: { testId } });
    await tx.question.deleteMany({ where: { testId } });
    await tx.test.delete({ where: { id: testId } });
  });

  revalidateTestEditor(context.courseId, context.lessonId);

  if (context.lessonId) {
    redirect(`/admin/courses/${context.courseId}/lessons/${context.lessonId}`);
  }

  redirect(`/admin/courses/${context.courseId}`);
}

export async function createQuestionAction(formData: FormData) {
  await requireAdmin();

  const testId = String(formData.get("testId") ?? "");

  if (!testId) {
    return;
  }

  const context = await getTestContext(testId);

  if (!context) {
    return;
  }

  await assertNoAttempts(testId);

  const data = parseQuestionForm(formData);
  const lastQuestion = await prisma.question.findFirst({
    where: { testId },
    orderBy: { order: "desc" },
    select: { order: true }
  });

  await prisma.question.create({
    data: {
      ...data,
      testId,
      order: (lastQuestion?.order ?? 0) + 1
    }
  });

  revalidateTestEditor(context.courseId, context.lessonId);
}

export async function updateQuestionAction(formData: FormData) {
  await requireAdmin();

  const questionId = String(formData.get("questionId") ?? "");

  if (!questionId) {
    return;
  }

  const context = await getQuestionContext(questionId);

  if (!context) {
    return;
  }

  await assertNoAttempts(context.testId);

  await prisma.question.update({
    where: { id: questionId },
    data: parseQuestionForm(formData)
  });

  revalidateTestEditor(context.test.courseId, context.test.lessonId);

  if (context.test.lessonId) {
    revalidatePath(`/admin/courses/${context.test.courseId}/lessons/${context.test.lessonId}/test/questions/${questionId}`);
  } else {
    revalidatePath(`/admin/courses/${context.test.courseId}/test/questions/${questionId}`);
  }
}

export async function deleteQuestionAction(formData: FormData) {
  await requireAdmin();

  const questionId = String(formData.get("questionId") ?? "");

  if (!questionId) {
    return;
  }

  const questionContext = await getQuestionContext(questionId);

  if (!questionContext) {
    return;
  }

  await assertNoAttempts(questionContext.testId);

  const context = await prisma.$transaction(async (tx) => {
    const question = await tx.question.findUnique({
      where: { id: questionId },
      select: { testId: true, test: { select: { courseId: true, lessonId: true } } }
    });

    if (!question) {
      return null;
    }

    await tx.answerAttempt.deleteMany({ where: { questionId } });
    await tx.question.delete({ where: { id: questionId } });

    const questions = await tx.question.findMany({
      where: { testId: question.testId },
      orderBy: { order: "asc" },
      select: { id: true }
    });

    for (const [index, item] of questions.entries()) {
      await tx.question.update({
        where: { id: item.id },
        data: { order: index + 1 }
      });
    }

    return question.test;
  });

  if (context) {
    revalidateTestEditor(context.courseId, context.lessonId);
  }
}

export async function reorderQuestionAction(formData: FormData) {
  await requireAdmin();

  const questionId = String(formData.get("questionId") ?? "");
  const direction = String(formData.get("direction") ?? "");

  if (!questionId || (direction !== "up" && direction !== "down")) {
    return;
  }

  const questionContext = await getQuestionContext(questionId);

  if (!questionContext) {
    return;
  }

  await assertNoAttempts(questionContext.testId);

  const context = await prisma.$transaction(async (tx) => {
    const question = await tx.question.findUnique({
      where: { id: questionId },
      select: { id: true, testId: true, order: true, test: { select: { courseId: true, lessonId: true } } }
    });

    if (!question) {
      return null;
    }

    const neighbor = await tx.question.findFirst({
      where: {
        testId: question.testId,
        order: direction === "up" ? { lt: question.order } : { gt: question.order }
      },
      orderBy: { order: direction === "up" ? "desc" : "asc" },
      select: { id: true, order: true }
    });

    if (!neighbor) {
      return question.test;
    }

    const lastQuestion = await tx.question.findFirst({
      where: { testId: question.testId },
      orderBy: { order: "desc" },
      select: { order: true }
    });
    const tempOrder = (lastQuestion?.order ?? 0) + 1;

    await tx.question.update({ where: { id: question.id }, data: { order: tempOrder } });
    await tx.question.update({ where: { id: neighbor.id }, data: { order: question.order } });
    await tx.question.update({ where: { id: question.id }, data: { order: neighbor.order } });

    return question.test;
  });

  if (context) {
    revalidateTestEditor(context.courseId, context.lessonId);
  }
}
