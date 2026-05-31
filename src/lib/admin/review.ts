"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

async function loadAttemptForReview(answerAttemptId: string) {
  return prisma.answerAttempt.findUnique({
    where: { id: answerAttemptId },
    include: {
      question: { select: { id: true, type: true, points: true, testId: true } },
      attempt: {
        include: {
          user: { select: { id: true, departmentId: true } },
          test: {
            select: {
              id: true,
              passPercent: true,
              maxAttempts: true,
              courseId: true,
              lessonId: true,
              course: { select: { slug: true } },
              questions: { select: { id: true, type: true, points: true, answerKey: true, options: true } }
            }
          }
        }
      }
    }
  });
}

async function recomputeAttemptScore(attemptId: string) {
  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    include: {
      answers: true,
      test: {
        select: {
          passPercent: true,
          courseId: true,
          lessonId: true,
          course: { select: { slug: true } },
          questions: { select: { id: true, type: true, points: true } }
        }
      }
    }
  });
  if (!attempt) return null;

  const questionPoints = new Map(attempt.test.questions.map((q) => [q.id, q.points]));
  let total = 0;
  let earned = 0;
  let pending = false;
  let rejected = false;

  for (const ans of attempt.answers) {
    const points = questionPoints.get(ans.questionId) ?? 0;
    total += points;
    if (ans.isCorrect === true) earned += points;
    if (ans.reviewStatus === "PENDING") pending = true;
    if (ans.reviewStatus === "REJECTED") rejected = true;
  }

  const percent = total === 0 ? 0 : Math.round((earned / total) * 100);
  const reviewStatus: "PENDING" | "APPROVED" | "REJECTED" | "NOT_REQUIRED" = pending
    ? "PENDING"
    : rejected
      ? "REJECTED"
      : attempt.answers.some((a) => a.reviewStatus === "APPROVED")
        ? "APPROVED"
        : "NOT_REQUIRED";
  const passed = !pending && percent >= attempt.test.passPercent;

  await prisma.testAttempt.update({
    where: { id: attemptId },
    data: {
      scorePercent: pending ? null : percent,
      reviewStatus,
      passed
    }
  });

  return { attempt, passed, courseSlug: attempt.test.course.slug, lessonId: attempt.test.lessonId };
}

async function maybeMarkProgressOnPass(attemptId: string) {
  const result = await recomputeAttemptScore(attemptId);
  if (!result || !result.passed) return result;

  const { attempt } = result;
  const now = new Date();

  if (attempt.test.lessonId) {
    // lesson test passed → mark lesson done + update Enrollment
    await prisma.$transaction(async (tx) => {
      await tx.lessonProgress.upsert({
        where: { userId_lessonId: { userId: attempt.userId, lessonId: attempt.test.lessonId! } },
        update: { isCompleted: true, completedAt: now },
        create: { userId: attempt.userId, lessonId: attempt.test.lessonId!, isCompleted: true, completedAt: now, secondsSeen: 0 }
      });

      const [totalLessons, completedLessons] = await Promise.all([
        tx.lesson.count({ where: { courseId: attempt.test.courseId } }),
        tx.lessonProgress.count({
          where: { userId: attempt.userId, isCompleted: true, lesson: { courseId: attempt.test.courseId } }
        })
      ]);
      const progress = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0;

      await tx.enrollment.upsert({
        where: { userId_courseId: { userId: attempt.userId, courseId: attempt.test.courseId } },
        update: { progress, lastLessonId: attempt.test.lessonId, completedAt: progress === 100 ? now : null },
        create: {
          userId: attempt.userId,
          courseId: attempt.test.courseId,
          progress,
          lastLessonId: attempt.test.lessonId,
          completedAt: progress === 100 ? now : null
        }
      });
    });
  } else {
    // course final test passed → mark Enrollment 100 if all lessons done
    const total = await prisma.lesson.count({ where: { courseId: attempt.test.courseId } });
    const done = await prisma.lessonProgress.count({
      where: { userId: attempt.userId, isCompleted: true, lesson: { courseId: attempt.test.courseId } }
    });
    if (total > 0 && done >= total) {
      await prisma.enrollment.upsert({
        where: { userId_courseId: { userId: attempt.userId, courseId: attempt.test.courseId } },
        update: { progress: 100, completedAt: now },
        create: { userId: attempt.userId, courseId: attempt.test.courseId, progress: 100, completedAt: now }
      });
    }
  }

  return result;
}

async function ensureReviewerScope(answerAttemptId: string): Promise<{ userId: string; isRop: boolean; ropDepartmentId: string | null }> {
  const session = await requireSession();
  if (session.role === "ADMIN") {
    return { userId: session.userId, isRop: false, ropDepartmentId: null };
  }
  if (session.role !== "ROP") {
    throw new Error("Доступ запрещён");
  }

  const rop = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { departmentId: true }
  });
  if (!rop?.departmentId) throw new Error("РОП без отдела");

  const answer = await loadAttemptForReview(answerAttemptId);
  if (!answer) throw new Error("Ответ не найден");
  if (answer.attempt.user.departmentId !== rop.departmentId) {
    throw new Error("Ответ из чужого отдела");
  }

  return { userId: session.userId, isRop: true, ropDepartmentId: rop.departmentId };
}

export async function reviewAnswerAction(formData: FormData): Promise<void> {
  const answerAttemptId = String(formData.get("answerAttemptId") ?? "");
  const decision = String(formData.get("decision") ?? ""); // "approve" | "reject"
  const comment = String(formData.get("comment") ?? "").trim();

  if (!answerAttemptId || (decision !== "approve" && decision !== "reject")) return;

  const reviewer = await ensureReviewerScope(answerAttemptId);

  const answer = await loadAttemptForReview(answerAttemptId);
  if (!answer || answer.question.type !== "TEXT") throw new Error("Можно проверять только открытые ответы");
  if (answer.reviewStatus !== "PENDING") return;

  await prisma.answerAttempt.update({
    where: { id: answerAttemptId },
    data: {
      isCorrect: decision === "approve",
      reviewStatus: decision === "approve" ? "APPROVED" : "REJECTED",
      reviewComment: comment || null,
      reviewedById: reviewer.userId,
      reviewedAt: new Date()
    }
  });

  await maybeMarkProgressOnPass(answer.attemptId);

  revalidatePath("/admin/review");
  revalidatePath("/team/review");
  revalidatePath("/");
  revalidatePath(`/courses/${answer.attempt.test.course.slug}`);
}
