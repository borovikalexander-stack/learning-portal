import "server-only";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export type QuestionType = "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TEXT" | "MATCHING";

export type TakingQuestion = {
  id: string;
  type: QuestionType;
  prompt: string;
  order: number;
  points: number;
  options: unknown;
};

export type TakingTest = {
  id: string;
  title: string;
  passPercent: number;
  maxAttempts: number;
  timeLimitMins: number | null;
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  lessonId: string | null;
  lessonTitle: string | null;
  lessonOrder: number | null;
  attemptsUsed: number;
  bestAttempt: AttemptSummary | null;
  questions: TakingQuestion[];
};

export type AttemptSummary = {
  id: string;
  scorePercent: number | null;
  passed: boolean;
  reviewStatus: "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED";
  submittedAt: Date;
};

export type AttemptResult = {
  attempt: AttemptSummary & {
    testId: string;
    courseSlug: string;
    lessonId: string | null;
  };
  test: {
    title: string;
    passPercent: number;
    maxAttempts: number;
    courseTitle: string;
    lessonTitle: string | null;
  };
  totalAttempts: number;
  questions: {
    id: string;
    type: QuestionType;
    prompt: string;
    order: number;
    points: number;
    isCorrect: boolean | null;
    reviewStatus: "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED";
    reviewComment: string | null;
    answerValue: unknown;
    options: unknown;
    answerKey: unknown;
  }[];
};

function isCorrectAnswer(
  type: QuestionType,
  options: unknown,
  answerKey: unknown,
  value: unknown
): boolean {
  if (type === "TEXT") return false; // never auto-correct

  if (type === "SINGLE_CHOICE") {
    if (!answerKey || typeof answerKey !== "object" || !("correctIndex" in answerKey)) return false;
    const correct = Number((answerKey as { correctIndex: unknown }).correctIndex);
    return Number(value) === correct;
  }

  if (type === "MULTIPLE_CHOICE") {
    if (!answerKey || typeof answerKey !== "object" || !("correctIndices" in answerKey)) return false;
    const correctRaw = (answerKey as { correctIndices: unknown }).correctIndices;
    if (!Array.isArray(correctRaw) || !Array.isArray(value)) return false;
    const correct = [...correctRaw].map(Number).sort();
    const submitted = [...value].map(Number).sort();
    return correct.length === submitted.length && correct.every((v, i) => v === submitted[i]);
  }

  if (type === "MATCHING") {
    if (!answerKey || typeof answerKey !== "object" || !("pairs" in answerKey)) return false;
    const pairs = (answerKey as { pairs: Record<string, unknown> }).pairs ?? {};
    if (!value || typeof value !== "object") return false;
    const submitted = value as Record<string, unknown>;
    const keys = Object.keys(pairs);
    if (keys.length === 0) return false;
    return keys.every((k) => Number(pairs[k]) === Number(submitted[k]));
  }

  return false;
}

function parseSubmittedValue(type: QuestionType, raw: FormDataEntryValue | null, formData: FormData, questionId: string): unknown {
  if (type === "SINGLE_CHOICE") {
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isInteger(n) ? n : null;
  }
  if (type === "MULTIPLE_CHOICE") {
    // checkboxes: gather all q-{id} values
    const all = formData.getAll(`q-${questionId}`).map((v) => Number(v)).filter((n) => Number.isInteger(n));
    return all;
  }
  if (type === "TEXT") {
    return typeof raw === "string" ? raw.trim() : "";
  }
  if (type === "MATCHING") {
    // formData has q-{id}-leftIdx=rightIdx for each pair
    const pairs: Record<string, number> = {};
    for (const [key, value] of formData.entries()) {
      if (key.startsWith(`q-${questionId}-`)) {
        const leftIdx = key.slice(`q-${questionId}-`.length);
        const rightIdx = Number(value);
        if (Number.isInteger(rightIdx)) {
          pairs[leftIdx] = rightIdx;
        }
      }
    }
    return pairs;
  }
  return null;
}

export async function getTestForTaking(userId: string, testId: string): Promise<TakingTest | null> {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      course: { select: { id: true, slug: true, title: true } },
      lesson: { select: { id: true, title: true, order: true } },
      questions: { orderBy: { order: "asc" } },
      attempts: {
        where: { userId },
        orderBy: { submittedAt: "desc" },
        take: 50
      }
    }
  });
  if (!test) return null;

  // verify access
  const access = await prisma.courseAccess.findUnique({
    where: { userId_courseId: { userId, courseId: test.courseId } }
  });
  if (!access) return null;

  const attemptsUsed = test.attempts.length;
  const bestAttempt = test.attempts
    .filter((a) => a.scorePercent !== null)
    .sort((a, b) => (b.scorePercent ?? 0) - (a.scorePercent ?? 0))[0];

  return {
    id: test.id,
    title: test.title,
    passPercent: test.passPercent,
    maxAttempts: test.maxAttempts,
    timeLimitMins: test.timeLimitMins,
    courseId: test.course.id,
    courseSlug: test.course.slug,
    courseTitle: test.course.title,
    lessonId: test.lesson?.id ?? null,
    lessonTitle: test.lesson?.title ?? null,
    lessonOrder: test.lesson?.order ?? null,
    attemptsUsed,
    bestAttempt: bestAttempt
      ? {
          id: bestAttempt.id,
          scorePercent: bestAttempt.scorePercent,
          passed: bestAttempt.passed,
          reviewStatus: bestAttempt.reviewStatus,
          submittedAt: bestAttempt.submittedAt
        }
      : null,
    questions: test.questions.map((q) => ({
      id: q.id,
      type: q.type as QuestionType,
      prompt: q.prompt,
      order: q.order,
      points: q.points,
      options: q.options
    }))
  };
}

export async function getAttemptResult(userId: string, attemptId: string): Promise<AttemptResult | null> {
  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    include: {
      test: {
        include: {
          course: { select: { slug: true, title: true } },
          lesson: { select: { id: true, title: true } },
          questions: { orderBy: { order: "asc" } }
        }
      },
      answers: true
    }
  });
  if (!attempt) return null;
  if (attempt.userId !== userId) return null;

  const totalAttempts = await prisma.testAttempt.count({ where: { userId, testId: attempt.testId } });
  const answerByQ = new Map(attempt.answers.map((a) => [a.questionId, a]));

  return {
    attempt: {
      id: attempt.id,
      scorePercent: attempt.scorePercent,
      passed: attempt.passed,
      reviewStatus: attempt.reviewStatus,
      submittedAt: attempt.submittedAt,
      testId: attempt.testId,
      courseSlug: attempt.test.course.slug,
      lessonId: attempt.test.lesson?.id ?? null
    },
    test: {
      title: attempt.test.title,
      passPercent: attempt.test.passPercent,
      maxAttempts: attempt.test.maxAttempts,
      courseTitle: attempt.test.course.title,
      lessonTitle: attempt.test.lesson?.title ?? null
    },
    totalAttempts,
    questions: attempt.test.questions.map((q) => {
      const a = answerByQ.get(q.id);
      return {
        id: q.id,
        type: q.type as QuestionType,
        prompt: q.prompt,
        order: q.order,
        points: q.points,
        isCorrect: a?.isCorrect ?? null,
        reviewStatus: a?.reviewStatus ?? "NOT_REQUIRED",
        reviewComment: a?.reviewComment ?? null,
        answerValue: a?.value ?? null,
        options: q.options,
        answerKey: q.answerKey
      };
    })
  };
}

export type SubmitResult =
  | { ok: true; attemptId: string }
  | { ok: false; error: string };

/**
 * Submit attempt: scores closed questions, stores TEXT as pending review,
 * updates lesson/course progress if applicable and passed.
 */
export async function submitTestAttempt(userId: string, testId: string, formData: FormData): Promise<SubmitResult> {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      course: { select: { id: true, slug: true } },
      lesson: { select: { id: true, courseId: true } },
      questions: { orderBy: { order: "asc" } }
    }
  });
  if (!test) return { ok: false, error: "Тест не найден" };

  // access check
  const access = await prisma.courseAccess.findUnique({
    where: { userId_courseId: { userId, courseId: test.courseId } }
  });
  if (!access) return { ok: false, error: "Нет доступа к курсу" };

  // attempts check
  const used = await prisma.testAttempt.count({ where: { userId, testId } });
  if (used >= test.maxAttempts) {
    return { ok: false, error: "Все попытки использованы" };
  }

  // collect answers
  let autoPoints = 0;
  let maxAutoPoints = 0;
  let needsReview = false;

  const answerRecords: {
    questionId: string;
    value: unknown;
    isCorrect: boolean | null;
    reviewStatus: "NOT_REQUIRED" | "PENDING";
  }[] = [];

  for (const q of test.questions) {
    const type = q.type as QuestionType;
    const raw = formData.get(`q-${q.id}`);
    const value = parseSubmittedValue(type, raw, formData, q.id);

    if (type === "TEXT") {
      const text = typeof value === "string" ? value : "";
      answerRecords.push({
        questionId: q.id,
        value: { text },
        isCorrect: null,
        reviewStatus: text.length > 0 ? "PENDING" : "PENDING"
      });
      needsReview = true;
    } else {
      maxAutoPoints += q.points;
      const correct = isCorrectAnswer(type, q.options, q.answerKey, value);
      if (correct) autoPoints += q.points;
      answerRecords.push({
        questionId: q.id,
        value: { value },
        isCorrect: correct,
        reviewStatus: "NOT_REQUIRED"
      });
    }
  }

  const autoPercent = maxAutoPoints === 0 ? 0 : Math.round((autoPoints / maxAutoPoints) * 100);
  const reviewStatus: "NOT_REQUIRED" | "PENDING" = needsReview ? "PENDING" : "NOT_REQUIRED";
  const passed = !needsReview && autoPercent >= test.passPercent;

  const attempt = await prisma.$transaction(async (tx) => {
    const created = await tx.testAttempt.create({
      data: {
        userId,
        testId,
        scorePercent: needsReview ? null : autoPercent,
        passed,
        reviewStatus
      }
    });

    await tx.answerAttempt.createMany({
      data: answerRecords.map((a) => ({
        attemptId: created.id,
        questionId: a.questionId,
        value: a.value as object,
        isCorrect: a.isCorrect,
        reviewStatus: a.reviewStatus
      }))
    });

    return created;
  });

  // If passed AND test belongs to lesson → mark lesson completed and update enrollment
  if (passed && test.lesson) {
    await markLessonCompletedOnPass(userId, test.lesson.id, test.course.id);
  } else if (passed && !test.lesson) {
    // Course final test passed — mark Enrollment as completed if all lessons completed
    await markCourseCompletedOnFinalPass(userId, test.course.id);
  }

  revalidatePath(`/courses/${test.course.slug}`);
  if (test.lesson) {
    revalidatePath(`/courses/${test.course.slug}/lessons/${test.lesson.id}`);
  }
  revalidatePath("/");

  return { ok: true, attemptId: attempt.id };
}

async function markLessonCompletedOnPass(userId: string, lessonId: string, courseId: string) {
  await prisma.$transaction(async (tx) => {
    const now = new Date();
    await tx.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: { isCompleted: true, completedAt: now },
      create: { userId, lessonId, isCompleted: true, completedAt: now, secondsSeen: 0 }
    });

    const [totalLessons, completedLessons] = await Promise.all([
      tx.lesson.count({ where: { courseId } }),
      tx.lessonProgress.count({
        where: { userId, isCompleted: true, lesson: { courseId } }
      })
    ]);
    const progress = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0;

    await tx.enrollment.upsert({
      where: { userId_courseId: { userId, courseId } },
      update: { progress, lastLessonId: lessonId, completedAt: progress === 100 ? now : null },
      create: {
        userId,
        courseId,
        progress,
        lastLessonId: lessonId,
        completedAt: progress === 100 ? now : null
      }
    });
  });
}

async function markCourseCompletedOnFinalPass(userId: string, courseId: string) {
  const now = new Date();
  const totalLessons = await prisma.lesson.count({ where: { courseId } });
  const completedLessons = await prisma.lessonProgress.count({
    where: { userId, isCompleted: true, lesson: { courseId } }
  });
  if (totalLessons > 0 && completedLessons < totalLessons) return; // can't complete course without all lessons

  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId, courseId } },
    update: { progress: 100, completedAt: now },
    create: { userId, courseId, progress: 100, completedAt: now }
  });
}

/** Check whether a lesson test has been passed by user. */
export async function lessonTestPassed(userId: string, lessonId: string): Promise<boolean> {
  const test = await prisma.test.findUnique({
    where: { lessonId },
    select: { id: true }
  });
  if (!test) return true; // no test → considered passed
  const passed = await prisma.testAttempt.findFirst({
    where: { userId, testId: test.id, passed: true },
    select: { id: true }
  });
  return Boolean(passed);
}
