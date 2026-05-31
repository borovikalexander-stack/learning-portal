import "server-only";

import { prisma } from "@/lib/db";

export type PeriodKey = "7d" | "30d" | "90d" | "all";

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  "7d": "7 дней",
  "30d": "30 дней",
  "90d": "90 дней",
  all: "Всё время"
};

export const PERIOD_DAYS: Record<PeriodKey, number | null> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  all: null
};

export type DeptBreakdown = Record<string, number>;

export type DashboardKpis = {
  activeManagers: number;
  activeManagersByDept: DeptBreakdown;
  pendingApplications: number;
  pendingByDept: DeptBreakdown;
  averageProgress: number;
  averageProgressByDept: DeptBreakdown;
  coursesCompletedRecent: number;
  lessonsCompletedRecent: number;
  period: PeriodKey;
  rangeStart: Date | null;
  rangeEnd: Date | null;
  isCustomRange: boolean;
};

export type DepartmentBreakdown = {
  id: string;
  slug: string;
  name: string;
  managersCount: number;
  averageProgress: number;
  coursesCompleted: number;
  coursesAssigned: number;
  pendingApplications: number;
};

export type CourseEfficiency = {
  id: string;
  slug: string;
  title: string;
  departmentName: string;
  accent: string;
  assigned: number;
  averageProgress: number;
  completed: number;
};

export type StuckManager = {
  id: string;
  firstName: string;
  lastName: string;
  departmentName: string | null;
  assignedCourses: number;
  averageProgress: number;
  lastActivityDaysAgo: number | null;
};

export type ActivityPoint = {
  date: string;
  lessonsCompleted: number;
  coursesCompleted: number;
};

export type ActivityFeedItem = {
  id: string;
  type: "lesson" | "course";
  userId: string;
  userFirstName: string;
  userLastName: string;
  userAvatarUrl: string | null;
  departmentName: string | null;
  courseTitle: string;
  lessonTitle?: string;
  at: Date;
};

export type AdminDashboard = {
  kpis: DashboardKpis;
  departments: DepartmentBreakdown[];
  courses: CourseEfficiency[];
  topCourses: CourseEfficiency[];
  worstCourses: CourseEfficiency[];
  stuckManagers: StuckManager[];
  activity: ActivityPoint[];
  recentActivity: ActivityFeedItem[];
};

export type ManagerProfile = {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    status: "PENDING" | "ACTIVE" | "BLOCKED";
    departmentName: string | null;
    createdAt: Date;
    lastActivityAt: Date | null;
  };
  kpis: {
    assigned: number;
    completed: number;
    averageProgress: number;
    lessonsCompleted: number;
  };
  courses: {
    id: string;
    slug: string;
    title: string;
    departmentName: string;
    accent: string;
    accessSource: "DEPARTMENT_DEFAULT" | "MANUAL_GRANT";
    progressPercent: number;
    lessons: {
      id: string;
      title: string;
      order: number;
      isCompleted: boolean;
      completedAt: Date | null;
    }[];
  }[];
  history: {
    type: "lesson" | "course";
    lessonTitle?: string;
    courseTitle: string;
    at: Date;
  }[];
  availableCoursesToGrant: {
    id: string;
    slug: string;
    title: string;
    departmentId: string;
    departmentName: string;
  }[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function roundAverage(value: number | null | undefined) {
  return Math.round(value ?? 0);
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function daysAgo(date: Date | null) {
  if (!date) {
    return null;
  }

  return Math.max(0, Math.floor((Date.now() - date.getTime()) / DAY_MS));
}

function maxDate(dates: (Date | null | undefined)[]) {
  const timestamps = dates.flatMap((date) => (date ? [date.getTime()] : []));

  if (timestamps.length === 0) {
    return null;
  }

  return new Date(Math.max(...timestamps));
}

export function normalizePeriod(value: string | undefined): PeriodKey {
  if (value === "7d" || value === "90d" || value === "all") return value;
  return "30d";
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isFinite(d.getTime()) ? d : null;
}

function diffDays(start: Date, end: Date) {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / DAY_MS));
}

function buildActivityBuckets({
  period,
  periodStart,
  periodEnd,
  isCustomRange,
  today
}: {
  period: PeriodKey;
  periodStart: Date;
  periodEnd: Date;
  isCustomRange: boolean;
  today: Date;
}) {
  if (period === "all" && !isCustomRange) {
    const firstMonth = addMonths(startOfMonth(today), -11);
    return Array.from({ length: 12 }, (_, index) => {
      const start = addMonths(firstMonth, index);
      return {
        date: formatDateKey(start),
        start,
        end: addMonths(start, 1)
      };
    });
  }

  const totalDays = diffDays(periodStart, periodEnd);
  const useWeeks = totalDays > 31;
  const stepDays = useWeeks ? 7 : 1;
  const maxBuckets = useWeeks ? Math.ceil(totalDays / stepDays) : Math.min(totalDays, 30);
  const start = useWeeks ? periodStart : addDays(periodEnd, -maxBuckets);
  const buckets = [];

  for (let cursor = start; cursor < periodEnd; cursor = addDays(cursor, stepDays)) {
    const next = addDays(cursor, stepDays);
    buckets.push({
      date: formatDateKey(cursor),
      start: cursor,
      end: next > periodEnd ? periodEnd : next
    });
  }

  return buckets;
}

export type DashboardOptions = {
  period?: PeriodKey;
  from?: string;
  to?: string;
};

export async function getAdminDashboard(options: DashboardOptions = {}): Promise<AdminDashboard> {
  const today = startOfDay(new Date());
  const period = options.period ?? "30d";
  const fromDate = parseDate(options.from);
  const toDate = parseDate(options.to);
  const isCustomRange = fromDate !== null;

  let periodStart: Date;
  let periodEnd: Date;

  if (isCustomRange && fromDate) {
    periodStart = fromDate;
    periodEnd = toDate ? addDays(toDate, 1) : addDays(today, 1);
  } else {
    const periodDays = PERIOD_DAYS[period];
    periodStart = periodDays === null ? new Date(0) : addDays(today, -periodDays);
    periodEnd = addDays(today, 1);
  }

  const activityBuckets = buildActivityBuckets({ period, periodStart, periodEnd, isCustomRange, today });
  const activityStart = activityBuckets[0]?.start ?? periodStart;
  const activityEnd = activityBuckets.at(-1)?.end ?? periodEnd;

  const [
    activeManagers,
    pendingApplications,
    averageProgressAggregate,
    coursesCompletedRecent,
    lessonsCompletedRecent,
    departments,
    courses,
    managers,
    pendingByDeptRaw,
    recentLessonProgress,
    recentCompletedCourses,
    feedLessons,
    feedCourses
  ] = await Promise.all([
    prisma.user.count({ where: { status: "ACTIVE", role: "MANAGER" } }),
    prisma.user.count({ where: { status: "PENDING", onboardingStatus: "ACCEPTED" } }),
    prisma.enrollment.aggregate({
      _avg: { progress: true },
      where: { user: { status: "ACTIVE", role: "MANAGER" } }
    }),
    prisma.enrollment.count({
      where: {
        completedAt: { gte: periodStart, lt: periodEnd },
        user: { status: "ACTIVE", role: "MANAGER" }
      }
    }),
    prisma.lessonProgress.count({
      where: {
        isCompleted: true,
        completedAt: { gte: periodStart, lt: periodEnd },
        user: { status: "ACTIVE", role: "MANAGER" }
      }
    }),
    prisma.department.findMany({
      orderBy: { name: "asc" },
      include: {
        users: {
          where: { status: "ACTIVE", role: "MANAGER" },
          select: {
            id: true,
            courseAccesses: { select: { id: true } },
            enrollments: {
              select: { progress: true, completedAt: true }
            }
          }
        }
      }
    }),
    prisma.course.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ department: { name: "asc" } }, { title: "asc" }],
      include: {
        department: true,
        courseAccesses: { select: { id: true } },
        enrollments: {
          where: { user: { status: "ACTIVE", role: "MANAGER" } },
          select: { progress: true }
        }
      }
    }),
    prisma.user.findMany({
      where: { status: "ACTIVE", role: "MANAGER" },
      include: {
        department: true,
        courseAccesses: { select: { id: true } },
        enrollments: { select: { progress: true, updatedAt: true } },
        lessonProgress: { select: { completedAt: true } }
      }
    }),
    prisma.user.findMany({
      where: { status: "PENDING", onboardingStatus: "ACCEPTED" },
      select: { requestedDept: true }
    }),
    prisma.lessonProgress.findMany({
      where: {
        isCompleted: true,
        completedAt: { gte: activityStart, lt: activityEnd },
        user: { status: "ACTIVE", role: "MANAGER" }
      },
      select: { completedAt: true }
    }),
    prisma.enrollment.findMany({
      where: {
        progress: 100,
        completedAt: { gte: activityStart, lt: activityEnd },
        user: { status: "ACTIVE", role: "MANAGER" }
      },
      select: { completedAt: true }
    }),
    prisma.lessonProgress.findMany({
      where: {
        isCompleted: true,
        completedAt: { not: null },
        user: { status: "ACTIVE", role: "MANAGER" }
      },
      orderBy: { completedAt: "desc" },
      take: 10,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true, department: { select: { name: true } } }
        },
        lesson: {
          select: { title: true, course: { select: { title: true } } }
        }
      }
    }),
    prisma.enrollment.findMany({
      where: {
        progress: 100,
        completedAt: { not: null },
        user: { status: "ACTIVE", role: "MANAGER" }
      },
      orderBy: { completedAt: "desc" },
      take: 10,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true, department: { select: { name: true } } }
        },
        course: { select: { title: true } }
      }
    })
  ]);

  // Department aggregates
  const departmentBreakdown: DepartmentBreakdown[] = departments.map((department) => {
    const progressValues = department.users.flatMap((user) => user.enrollments.map((enrollment) => enrollment.progress));
    const coursesCompleted = department.users.reduce(
      (count, user) =>
        count + user.enrollments.filter((e) => e.completedAt && e.completedAt >= periodStart && e.completedAt < periodEnd).length,
      0
    );
    const coursesAssigned = department.users.reduce((count, user) => count + user.courseAccesses.length, 0);
    const pendingApps = pendingByDeptRaw.filter((u) => u.requestedDept === department.slug).length;

    return {
      id: department.id,
      slug: department.slug,
      name: department.name,
      managersCount: department.users.length,
      averageProgress: average(progressValues),
      coursesCompleted,
      coursesAssigned,
      pendingApplications: pendingApps
    };
  });

  // KPI breakdowns by dept slug
  const activeManagersByDept: DeptBreakdown = {};
  const pendingByDept: DeptBreakdown = {};
  const averageProgressByDept: DeptBreakdown = {};

  for (const dept of departmentBreakdown) {
    activeManagersByDept[dept.slug] = dept.managersCount;
    pendingByDept[dept.slug] = dept.pendingApplications;
    averageProgressByDept[dept.slug] = dept.averageProgress;
  }

  // Course efficiency
  const courseEfficiency: CourseEfficiency[] = courses
    .map((course) => ({
      id: course.id,
      slug: course.slug,
      title: course.title,
      departmentName: course.department.name,
      accent: course.accent,
      assigned: course.courseAccesses.length,
      averageProgress: average(course.enrollments.map((enrollment) => enrollment.progress)),
      completed: course.enrollments.filter((enrollment) => enrollment.progress === 100).length
    }))
    .sort((left, right) => right.averageProgress - left.averageProgress);

  const coursesWithAssigned = courseEfficiency.filter((c) => c.assigned > 0);
  const topCourses = coursesWithAssigned.slice(0, 3);
  const worstCourses = [...coursesWithAssigned].reverse().slice(0, 3);

  // Stuck managers
  const stuckManagers = managers
    .map((manager) => {
      const lastActivityAt = maxDate([
        ...manager.enrollments.map((enrollment) => enrollment.updatedAt),
        ...manager.lessonProgress.map((progress) => progress.completedAt)
      ]);
      const lastActivityDaysAgo = daysAgo(lastActivityAt);
      const avgProgress = average(manager.enrollments.map((enrollment) => enrollment.progress));

      return {
        id: manager.id,
        firstName: manager.firstName,
        lastName: manager.lastName,
        departmentName: manager.department?.name ?? null,
        assignedCourses: manager.courseAccesses.length,
        averageProgress: avgProgress,
        lastActivityDaysAgo
      };
    })
    .filter((manager) => manager.lastActivityDaysAgo === null || (manager.lastActivityDaysAgo > 7 && manager.averageProgress < 50))
    .sort((left, right) => {
      if (left.lastActivityDaysAgo === null && right.lastActivityDaysAgo !== null) return -1;
      if (left.lastActivityDaysAgo !== null && right.lastActivityDaysAgo === null) return 1;
      return (right.lastActivityDaysAgo ?? 0) - (left.lastActivityDaysAgo ?? 0);
    })
    .slice(0, 10);

  const activity: ActivityPoint[] = activityBuckets.map((bucket) => ({
    date: bucket.date,
    lessonsCompleted: recentLessonProgress.filter(
      (progress) => progress.completedAt && progress.completedAt >= bucket.start && progress.completedAt < bucket.end
    ).length,
    coursesCompleted: recentCompletedCourses.filter(
      (enrollment) => enrollment.completedAt && enrollment.completedAt >= bucket.start && enrollment.completedAt < bucket.end
    ).length
  }));

  // Recent activity feed
  const feedLessonItems: ActivityFeedItem[] = feedLessons.map((p) => ({
    id: `l-${p.id}`,
    type: "lesson",
    userId: p.user.id,
    userFirstName: p.user.firstName,
    userLastName: p.user.lastName,
    userAvatarUrl: p.user.avatarUrl,
    departmentName: p.user.department?.name ?? null,
    courseTitle: p.lesson.course.title,
    lessonTitle: p.lesson.title,
    at: p.completedAt as Date
  }));

  const feedCourseItems: ActivityFeedItem[] = feedCourses.map((e) => ({
    id: `c-${e.id}`,
    type: "course",
    userId: e.user.id,
    userFirstName: e.user.firstName,
    userLastName: e.user.lastName,
    userAvatarUrl: e.user.avatarUrl,
    departmentName: e.user.department?.name ?? null,
    courseTitle: e.course.title,
    at: e.completedAt as Date
  }));

  const recentActivity = [...feedLessonItems, ...feedCourseItems]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 10);

  return {
    kpis: {
      activeManagers,
      activeManagersByDept,
      pendingApplications,
      pendingByDept,
      averageProgress: roundAverage(averageProgressAggregate._avg.progress),
      averageProgressByDept,
      coursesCompletedRecent,
      lessonsCompletedRecent,
      period,
      rangeStart: isCustomRange ? periodStart : null,
      rangeEnd: isCustomRange && toDate ? toDate : null,
      isCustomRange
    },
    departments: departmentBreakdown,
    courses: courseEfficiency,
    topCourses,
    worstCourses,
    stuckManagers,
    activity,
    recentActivity
  };
}

export async function getManagerProfile(userId: string): Promise<ManagerProfile> {
  const [user, publishedCourses] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        department: true,
        courseAccesses: {
          orderBy: { createdAt: "asc" },
          include: {
            course: {
              include: {
                department: true,
                lessons: {
                  orderBy: { order: "asc" },
                  select: { id: true, title: true, order: true }
                }
              }
            }
          }
        },
        enrollments: {
          include: {
            course: { select: { id: true, title: true } }
          }
        },
        lessonProgress: {
          include: {
            lesson: {
              include: {
                course: { select: { id: true, title: true } }
              }
            }
          }
        }
      }
    }),
    prisma.course.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ department: { name: "asc" } }, { title: "asc" }],
      include: { department: true }
    })
  ]);

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  const enrollmentByCourseId = new Map(user.enrollments.map((enrollment) => [enrollment.courseId, enrollment]));
  const progressByLessonId = new Map(user.lessonProgress.map((progress) => [progress.lessonId, progress]));
  const assignedCourseIds = new Set(user.courseAccesses.map((access) => access.courseId));
  const lastActivityAt = maxDate([
    ...user.enrollments.map((enrollment) => enrollment.updatedAt),
    ...user.lessonProgress.map((progress) => progress.completedAt)
  ]);

  const courses = user.courseAccesses.map((access) => ({
    id: access.course.id,
    slug: access.course.slug,
    title: access.course.title,
    departmentName: access.course.department.name,
    accent: access.course.accent,
    accessSource: access.source,
    progressPercent: enrollmentByCourseId.get(access.courseId)?.progress ?? 0,
    lessons: access.course.lessons.map((lesson) => {
      const progress = progressByLessonId.get(lesson.id);

      return {
        id: lesson.id,
        title: lesson.title,
        order: lesson.order,
        isCompleted: progress?.isCompleted ?? false,
        completedAt: progress?.completedAt ?? null
      };
    })
  }));

  const lessonHistory = user.lessonProgress
    .filter((progress) => progress.isCompleted && progress.completedAt)
    .map((progress) => ({
      type: "lesson" as const,
      lessonTitle: progress.lesson.title,
      courseTitle: progress.lesson.course.title,
      at: progress.completedAt as Date
    }));

  const courseHistory = user.enrollments
    .filter((enrollment) => enrollment.completedAt)
    .map((enrollment) => ({
      type: "course" as const,
      courseTitle: enrollment.course.title,
      at: enrollment.completedAt as Date
    }));

  return {
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      status: user.status,
      departmentName: user.department?.name ?? null,
      createdAt: user.createdAt,
      lastActivityAt
    },
    kpis: {
      assigned: user.courseAccesses.length,
      completed: user.enrollments.filter((enrollment) => enrollment.progress === 100).length,
      averageProgress: average(user.enrollments.map((enrollment) => enrollment.progress)),
      lessonsCompleted: user.lessonProgress.filter((progress) => progress.isCompleted).length
    },
    courses,
    history: [...lessonHistory, ...courseHistory].sort((left, right) => right.at.getTime() - left.at.getTime()).slice(0, 20),
    availableCoursesToGrant: publishedCourses
      .filter((course) => !assignedCourseIds.has(course.id))
      .map((course) => ({
        id: course.id,
        slug: course.slug,
        title: course.title,
        departmentId: course.departmentId,
        departmentName: course.department.name
      }))
  };
}
