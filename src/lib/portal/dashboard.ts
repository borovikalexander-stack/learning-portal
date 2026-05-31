import "server-only";

import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";

export type DashboardUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  departmentName: string | null;
};

export type DashboardCourse = {
  id: string;
  slug: string;
  title: string;
  description: string;
  accent: string;
  estimatedMins: number;
  lessonsCount: number;
  accessSource: "DEPARTMENT_DEFAULT" | "MANUAL_GRANT";
  departmentName: string;
  progressPercent: number;
};

export type DashboardNextStep = {
  type: "lesson" | "lessonTest" | "finalTest";
  courseSlug: string;
  courseTitle: string;
  courseAccent: string;
  targetTitle: string;
  href: string;
};

export type DashboardSnapshot = {
  user: DashboardUser;
  courses: DashboardCourse[];
  nextStep: DashboardNextStep | null;
  stats: {
    assigned: number;
    completed: number;
    averageScorePercent: number;
    pendingReviews: number;
  };
};

export async function getDashboardSnapshot(userId: string): Promise<DashboardSnapshot> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      department: true,
      courseAccesses: {
        include: {
          course: {
            include: {
              department: true,
              lessons: {
                orderBy: { order: "asc" },
                include: {
                  test: {
                    select: { id: true }
                  }
                }
              },
              tests: {
                where: { lessonId: null },
                orderBy: { createdAt: "asc" },
                select: { id: true }
              },
              _count: {
                select: { lessons: true }
              }
            }
          }
        },
        orderBy: { createdAt: "asc" }
      },
      enrollments: true,
      lessonProgress: true,
      testAttempts: {
        include: {
          test: {
            select: { courseId: true }
          }
        }
      }
    }
  });

  if (!user) {
    throw new Error("User not found");
  }

  const enrollmentsByCourseId = new Map(user.enrollments.map((enrollment) => [enrollment.courseId, enrollment]));
  const completedLessonIds = new Set(user.lessonProgress.filter((progress) => progress.isCompleted).map((progress) => progress.lessonId));
  const passedTestIds = new Set(user.testAttempts.filter((attempt) => attempt.passed).map((attempt) => attempt.testId));

  const courses = user.courseAccesses
    .filter((access) => access.course.status === "PUBLISHED")
    .map((access) => {
      const enrollment = enrollmentsByCourseId.get(access.courseId);

      return {
        id: access.course.id,
        slug: access.course.slug,
        title: access.course.title,
        description: access.course.description,
        accent: access.course.accent,
        estimatedMins: access.course.estimatedMins,
        lessonsCount: access.course._count.lessons,
        accessSource: access.source,
        departmentName: access.course.department.name,
        progressPercent: enrollment?.progress ?? 0
      };
    });

  const courseIds = new Set(courses.map((course) => course.id));
  const relevantEnrollments = user.enrollments.filter((enrollment) => courseIds.has(enrollment.courseId));
  const scoredAttempts = user.testAttempts.filter(
    (attempt) => courseIds.has(attempt.test.courseId) && attempt.scorePercent !== null
  );
  let nextStep: DashboardNextStep | null = null;

  for (const access of user.courseAccesses.filter((courseAccess) => courseAccess.course.status === "PUBLISHED")) {
    const course = access.course;

    for (const lesson of course.lessons) {
      const lessonTest = lesson.test;
      const lessonProgressCompleted = completedLessonIds.has(lesson.id);
      const lessonTestPassed = lessonTest ? passedTestIds.has(lessonTest.id) : true;

      if (lessonTest && lessonProgressCompleted && !lessonTestPassed) {
        nextStep = {
          type: "lessonTest",
          courseSlug: course.slug,
          courseTitle: course.title,
          courseAccent: course.accent,
          targetTitle: lesson.title,
          href: `/courses/${course.slug}/lessons/${lesson.id}/test`
        };
        break;
      }

      if (!(lessonProgressCompleted && lessonTestPassed)) {
        nextStep = {
          type: "lesson",
          courseSlug: course.slug,
          courseTitle: course.title,
          courseAccent: course.accent,
          targetTitle: lesson.title,
          href: `/courses/${course.slug}/lessons/${lesson.id}`
        };
        break;
      }
    }

    if (nextStep) {
      break;
    }

    const finalTest = course.tests[0];

    if (course.lessons.length > 0 && finalTest && !passedTestIds.has(finalTest.id)) {
      nextStep = {
        type: "finalTest",
        courseSlug: course.slug,
        courseTitle: course.title,
        courseAccent: course.accent,
        targetTitle: "Итоговый тест",
        href: `/courses/${course.slug}/test`
      };
      break;
    }
  }

  const pendingReviews = await prisma.answerAttempt.count({
    where: {
      reviewStatus: "PENDING",
      attempt: { userId }
    }
  });

  return {
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      departmentName: user.department?.name ?? null
    },
    courses,
    nextStep,
    stats: {
      assigned: courses.length,
      completed: relevantEnrollments.filter((enrollment) => enrollment.progress === 100).length,
      averageScorePercent: scoredAttempts.length
        ? Math.round(scoredAttempts.reduce((sum, attempt) => sum + (attempt.scorePercent ?? 0), 0) / scoredAttempts.length)
        : 0,
      pendingReviews
    }
  };
}
