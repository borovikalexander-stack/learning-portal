import "server-only";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export type LessonSummary = {
  id: string;
  title: string;
  order: number;
  durationMins: number;
  isCompleted: boolean;
  hasVideo: boolean;
  isLocked: boolean;
};

export type CourseDetail = {
  id: string;
  slug: string;
  title: string;
  description: string;
  departmentName: string;
  accent: string;
  estimatedMins: number;
  lessons: LessonSummary[];
  progressPercent: number;
  accessSource: "DEPARTMENT_DEFAULT" | "MANUAL_GRANT";
};

export type LessonDetail = {
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  departmentName: string;
  accent: string;
  id: string;
  title: string;
  order: number;
  durationMins: number;
  kinescopeId: string | null;
  markdown: string | null;
  attachments: { id: string; title: string; url: string }[];
  isCompleted: boolean;
  prevLessonId: string | null;
  nextLessonId: string | null;
  totalLessons: number;
  test: { id: string; passed: boolean } | null;
};

export async function getCourseDetail(userId: string, courseSlug: string): Promise<CourseDetail> {
  const course = await prisma.course.findUnique({
    where: { slug: courseSlug },
    include: {
      department: true,
      lessons: {
        orderBy: { order: "asc" }
      },
      courseAccesses: {
        where: { userId }
      }
    }
  });

  if (!course || course.status !== "PUBLISHED" || !course.courseAccesses.length) {
    throw new Error("NO_ACCESS");
  }

  const lessonIds = course.lessons.map((lesson) => lesson.id);
  const progress = await prisma.lessonProgress.findMany({
    where: {
      userId,
      lessonId: { in: lessonIds }
    }
  });
  const lessonTests = lessonIds.length
    ? await prisma.test.findMany({
        where: {
          lessonId: { in: lessonIds }
        },
        select: { id: true, lessonId: true }
      })
    : [];
  const lessonTestIds = lessonTests.map((test) => test.id);
  const passedAttempts = lessonTestIds.length
    ? await prisma.testAttempt.findMany({
        where: {
          userId,
          testId: { in: lessonTestIds },
          passed: true
        },
        select: { testId: true }
      })
    : [];
  const completedLessonIds = new Set(progress.filter((item) => item.isCompleted).map((item) => item.lessonId));
  const testByLessonId = new Map(lessonTests.flatMap((test) => (test.lessonId ? [[test.lessonId, test]] : [])));
  const passedTestIds = new Set(passedAttempts.map((attempt) => attempt.testId));
  const effectivelyCompletedByLessonId = new Map(
    course.lessons.map((lesson) => {
      const test = testByLessonId.get(lesson.id);
      const testPassed = test ? passedTestIds.has(test.id) : true;
      return [lesson.id, completedLessonIds.has(lesson.id) && testPassed] as const;
    })
  );
  const completedCount = Array.from(effectivelyCompletedByLessonId.values()).filter(Boolean).length;

  const lessons = course.lessons.map((lesson, index) => {
    const previousLesson = index > 0 ? course.lessons[index - 1] : null;
    const isCompleted = effectivelyCompletedByLessonId.get(lesson.id) ?? false;
    const previousEffectivelyCompleted = previousLesson ? (effectivelyCompletedByLessonId.get(previousLesson.id) ?? false) : true;

    return {
      id: lesson.id,
      title: lesson.title,
      order: lesson.order,
      durationMins: lesson.durationMins,
      isCompleted,
      hasVideo: Boolean(lesson.kinescopeId),
      isLocked: previousLesson ? !previousEffectivelyCompleted : false
    };
  });

  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    description: course.description,
    departmentName: course.department.name,
    accent: course.accent,
    estimatedMins: course.estimatedMins,
    lessons,
    progressPercent: course.lessons.length ? Math.round((completedCount / course.lessons.length) * 100) : 0,
    accessSource: course.courseAccesses[0].source
  };
}

export async function getLessonDetail(userId: string, courseSlug: string, lessonId: string): Promise<LessonDetail> {
  const course = await prisma.course.findUnique({
    where: { slug: courseSlug },
    include: {
      department: true,
      courseAccesses: {
        where: { userId }
      },
      lessons: {
        orderBy: { order: "asc" },
        include: {
          attachments: true
        }
      }
    }
  });

  if (!course || course.status !== "PUBLISHED" || !course.courseAccesses.length) {
    throw new Error("NO_ACCESS");
  }

  const lessonIndex = course.lessons.findIndex((lesson) => lesson.id === lessonId);
  const lesson = course.lessons[lessonIndex];

  if (!lesson || lesson.courseId !== course.id) {
    throw new Error("NO_ACCESS");
  }

  const previousLesson = lessonIndex > 0 ? course.lessons[lessonIndex - 1] : null;
  const nextLesson = lessonIndex < course.lessons.length - 1 ? course.lessons[lessonIndex + 1] : null;
  const progress = await prisma.lessonProgress.findMany({
    where: {
      userId,
      lessonId: { in: [lesson.id, previousLesson?.id].filter(Boolean) as string[] }
    }
  });
  const completedLessonIds = new Set(progress.filter((item) => item.isCompleted).map((item) => item.lessonId));
  const lessonsToCheck = [lesson.id, previousLesson?.id].filter(Boolean) as string[];
  const lessonTests = lessonsToCheck.length
    ? await prisma.test.findMany({
        where: { lessonId: { in: lessonsToCheck } },
        select: { id: true, lessonId: true }
      })
    : [];
  const lessonTestIds = lessonTests.map((test) => test.id);
  const passedAttempts = lessonTestIds.length
    ? await prisma.testAttempt.findMany({
        where: { userId, testId: { in: lessonTestIds }, passed: true },
        select: { testId: true }
      })
    : [];
  const testByLessonId = new Map(lessonTests.flatMap((test) => (test.lessonId ? [[test.lessonId, test]] : [])));
  const passedTestIds = new Set(passedAttempts.map((attempt) => attempt.testId));
  const isEffectivelyCompleted = (targetLessonId: string) => {
    const test = testByLessonId.get(targetLessonId);
    const testPassed = test ? passedTestIds.has(test.id) : true;
    return completedLessonIds.has(targetLessonId) && testPassed;
  };

  if (previousLesson && !isEffectivelyCompleted(previousLesson.id)) {
    throw new Error("LOCKED");
  }

  const lessonTest = testByLessonId.get(lesson.id) ?? null;
  const testPassed = lessonTest ? passedTestIds.has(lessonTest.id) : false;

  return {
    courseId: course.id,
    courseSlug: course.slug,
    courseTitle: course.title,
    departmentName: course.department.name,
    accent: course.accent,
    id: lesson.id,
    title: lesson.title,
    order: lesson.order,
    durationMins: lesson.durationMins,
    kinescopeId: lesson.kinescopeId,
    markdown: lesson.markdown,
    attachments: lesson.attachments.map((attachment) => ({
      id: attachment.id,
      title: attachment.title,
      url: attachment.url
    })),
    isCompleted: isEffectivelyCompleted(lesson.id),
    prevLessonId: previousLesson?.id ?? null,
    nextLessonId: nextLesson?.id ?? null,
    totalLessons: course.lessons.length,
    test: lessonTest ? { id: lessonTest.id, passed: testPassed } : null
  };
}

export async function markLessonComplete(userId: string, lessonId: string): Promise<void> {
  const courseSlug = await prisma.$transaction(async (tx) => {
    const lesson = await tx.lesson.findUnique({
      where: { id: lessonId },
      include: {
        course: {
          select: { id: true, slug: true }
        }
      }
    });

    if (!lesson) {
      return null;
    }

    const access = await tx.courseAccess.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId: lesson.courseId
        }
      }
    });

    if (!access) {
      return null;
    }

    const existingProgress = await tx.lessonProgress.findUnique({
      where: {
        userId_lessonId: {
          userId,
          lessonId
        }
      }
    });
    const now = new Date();

    await tx.lessonProgress.upsert({
      where: {
        userId_lessonId: {
          userId,
          lessonId
        }
      },
      update: {
        isCompleted: true,
        completedAt: now,
        secondsSeen: Math.max(existingProgress?.secondsSeen ?? 0, 0)
      },
      create: {
        userId,
        lessonId,
        isCompleted: true,
        completedAt: now,
        secondsSeen: 0
      }
    });

    const [totalLessons, completedLessons] = await Promise.all([
      tx.lesson.count({
        where: { courseId: lesson.courseId }
      }),
      tx.lessonProgress.count({
        where: {
          userId,
          isCompleted: true,
          lesson: {
            courseId: lesson.courseId
          }
        }
      })
    ]);
    const progress = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0;

    await tx.enrollment.upsert({
      where: {
        userId_courseId: {
          userId,
          courseId: lesson.courseId
        }
      },
      update: {
        progress,
        lastLessonId: lessonId,
        completedAt: progress === 100 ? now : null
      },
      create: {
        userId,
        courseId: lesson.courseId,
        progress,
        lastLessonId: lessonId,
        completedAt: progress === 100 ? now : null
      }
    });

    return lesson.course.slug;
  });

  if (courseSlug) {
    revalidatePath(`/courses/${courseSlug}`);
    revalidatePath("/");
  }
}
