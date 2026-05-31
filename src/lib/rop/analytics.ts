import "server-only";

import { prisma } from "@/lib/db";
import { normalizePeriod, PERIOD_DAYS, type PeriodKey } from "@/lib/admin/analytics";

export type RopDashboardKpis = {
  activeManagers: number;
  blockedManagers: number;
  pendingApplications: number;
  averageProgress: number;
  coursesCompletedRecent: number;
  lessonsCompletedRecent: number;
  period: PeriodKey;
  rangeStart: Date | null;
  rangeEnd: Date | null;
  isCustomRange: boolean;
};

export type RopCourseEfficiency = {
  id: string;
  slug: string;
  title: string;
  departmentName: string;
  accent: string;
  assigned: number;
  averageProgress: number;
  completed: number;
};

export type RopStuckManager = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  assignedCourses: number;
  averageProgress: number;
  lastActivityDaysAgo: number | null;
};

export type RopActivityPoint = {
  date: string;
  lessonsCompleted: number;
  coursesCompleted: number;
};

export type RopActivityFeedItem = {
  id: string;
  type: "lesson" | "course";
  userId: string;
  userFirstName: string;
  userLastName: string;
  userAvatarUrl: string | null;
  courseTitle: string;
  lessonTitle?: string;
  at: Date;
};

export type RopDashboard = {
  department: { id: string; slug: string; name: string };
  kpis: RopDashboardKpis;
  courses: RopCourseEfficiency[];
  topCourses: RopCourseEfficiency[];
  worstCourses: RopCourseEfficiency[];
  stuckManagers: RopStuckManager[];
  activity: RopActivityPoint[];
  recentActivity: RopActivityFeedItem[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function average(values: number[]) {
  if (values.length === 0) return 0;
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

function formatDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysAgo(date: Date | null) {
  if (!date) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / DAY_MS));
}

function maxDate(dates: (Date | null | undefined)[]) {
  const timestamps = dates.flatMap((d) => (d ? [d.getTime()] : []));
  if (timestamps.length === 0) return null;
  return new Date(Math.max(...timestamps));
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isFinite(d.getTime()) ? d : null;
}

export type RopDashboardOptions = {
  period?: PeriodKey;
  from?: string;
  to?: string;
};

export async function getRopDashboard(ropUserId: string, options: RopDashboardOptions = {}): Promise<RopDashboard | null> {
  const ropUser = await prisma.user.findUnique({
    where: { id: ropUserId },
    select: { departmentId: true, department: { select: { id: true, slug: true, name: true } } }
  });

  if (!ropUser?.department) return null;

  const department = ropUser.department;
  const today = startOfDay(new Date());
  const period = normalizePeriod(options.period);
  const fromDate = parseDate(options.from);
  const toDate = parseDate(options.to);
  const isCustomRange = fromDate !== null;

  let periodStart: Date;
  let periodEnd: Date;

  if (isCustomRange && fromDate) {
    periodStart = fromDate;
    periodEnd = toDate ? addDays(toDate, 1) : addDays(today, 1);
  } else {
    const days = PERIOD_DAYS[period];
    periodStart = days === null ? new Date(0) : addDays(today, -days);
    periodEnd = addDays(today, 1);
  }

  const activityStart = addDays(today, -13);
  const activityEnd = addDays(today, 1);

  const deptManagerFilter = {
    role: "MANAGER" as const,
    status: "ACTIVE" as const,
    departmentId: department.id
  };

  const [
    activeManagers,
    blockedManagers,
    pendingApplications,
    avgAggregate,
    coursesCompletedRecent,
    lessonsCompletedRecent,
    deptCourses,
    managers,
    recentLessonProgress,
    recentCompletedCourses,
    feedLessons,
    feedCourses
  ] = await Promise.all([
    prisma.user.count({ where: deptManagerFilter }),
    prisma.user.count({ where: { role: "MANAGER", status: "BLOCKED", departmentId: department.id } }),
    prisma.user.count({ where: { status: "PENDING", requestedDept: department.slug, onboardingStatus: "ACCEPTED" } }),
    prisma.enrollment.aggregate({
      _avg: { progress: true },
      where: { user: deptManagerFilter }
    }),
    prisma.enrollment.count({
      where: {
        completedAt: { gte: periodStart, lt: periodEnd },
        user: deptManagerFilter
      }
    }),
    prisma.lessonProgress.count({
      where: {
        isCompleted: true,
        completedAt: { gte: periodStart, lt: periodEnd },
        user: deptManagerFilter
      }
    }),
    // courses assigned to dept managers OR published in dept
    prisma.course.findMany({
      where: {
        status: "PUBLISHED",
        OR: [
          { departmentId: department.id },
          { courseAccesses: { some: { user: deptManagerFilter } } }
        ]
      },
      include: {
        department: true,
        courseAccesses: {
          where: { user: deptManagerFilter },
          select: { id: true }
        },
        enrollments: {
          where: { user: deptManagerFilter },
          select: { progress: true }
        }
      }
    }),
    prisma.user.findMany({
      where: deptManagerFilter,
      include: {
        courseAccesses: { select: { id: true } },
        enrollments: { select: { progress: true, updatedAt: true } },
        lessonProgress: { select: { completedAt: true } }
      }
    }),
    prisma.lessonProgress.findMany({
      where: {
        isCompleted: true,
        completedAt: { gte: activityStart, lt: activityEnd },
        user: deptManagerFilter
      },
      select: { completedAt: true }
    }),
    prisma.enrollment.findMany({
      where: {
        progress: 100,
        completedAt: { gte: activityStart, lt: activityEnd },
        user: deptManagerFilter
      },
      select: { completedAt: true }
    }),
    prisma.lessonProgress.findMany({
      where: {
        isCompleted: true,
        completedAt: { not: null },
        user: deptManagerFilter
      },
      orderBy: { completedAt: "desc" },
      take: 10,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        lesson: { select: { title: true, course: { select: { title: true } } } }
      }
    }),
    prisma.enrollment.findMany({
      where: {
        progress: 100,
        completedAt: { not: null },
        user: deptManagerFilter
      },
      orderBy: { completedAt: "desc" },
      take: 10,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        course: { select: { title: true } }
      }
    })
  ]);

  const courseEfficiency: RopCourseEfficiency[] = deptCourses
    .map((course) => ({
      id: course.id,
      slug: course.slug,
      title: course.title,
      departmentName: course.department.name,
      accent: course.accent,
      assigned: course.courseAccesses.length,
      averageProgress: average(course.enrollments.map((e) => e.progress)),
      completed: course.enrollments.filter((e) => e.progress === 100).length
    }))
    .filter((c) => c.assigned > 0)
    .sort((a, b) => b.averageProgress - a.averageProgress);

  const topCourses = courseEfficiency.slice(0, 3);
  const worstCourses = [...courseEfficiency].reverse().slice(0, 3);

  const stuckManagers = managers
    .map((m) => {
      const lastActivityAt = maxDate([
        ...m.enrollments.map((e) => e.updatedAt),
        ...m.lessonProgress.map((p) => p.completedAt)
      ]);
      return {
        id: m.id,
        firstName: m.firstName,
        lastName: m.lastName,
        avatarUrl: m.avatarUrl,
        assignedCourses: m.courseAccesses.length,
        averageProgress: average(m.enrollments.map((e) => e.progress)),
        lastActivityDaysAgo: daysAgo(lastActivityAt)
      };
    })
    .filter((m) => m.lastActivityDaysAgo === null || (m.lastActivityDaysAgo > 7 && m.averageProgress < 50))
    .sort((a, b) => {
      if (a.lastActivityDaysAgo === null && b.lastActivityDaysAgo !== null) return -1;
      if (a.lastActivityDaysAgo !== null && b.lastActivityDaysAgo === null) return 1;
      return (b.lastActivityDaysAgo ?? 0) - (a.lastActivityDaysAgo ?? 0);
    })
    .slice(0, 10);

  const activity: RopActivityPoint[] = Array.from({ length: 14 }, (_, index) => {
    const date = addDays(activityStart, index);
    const nextDate = addDays(date, 1);
    return {
      date: formatDateKey(date),
      lessonsCompleted: recentLessonProgress.filter((p) => p.completedAt && p.completedAt >= date && p.completedAt < nextDate).length,
      coursesCompleted: recentCompletedCourses.filter((e) => e.completedAt && e.completedAt >= date && e.completedAt < nextDate).length
    };
  });

  const feedLessonItems: RopActivityFeedItem[] = feedLessons.map((p) => ({
    id: `l-${p.id}`,
    type: "lesson",
    userId: p.user.id,
    userFirstName: p.user.firstName,
    userLastName: p.user.lastName,
    userAvatarUrl: p.user.avatarUrl,
    courseTitle: p.lesson.course.title,
    lessonTitle: p.lesson.title,
    at: p.completedAt as Date
  }));

  const feedCourseItems: RopActivityFeedItem[] = feedCourses.map((e) => ({
    id: `c-${e.id}`,
    type: "course",
    userId: e.user.id,
    userFirstName: e.user.firstName,
    userLastName: e.user.lastName,
    userAvatarUrl: e.user.avatarUrl,
    courseTitle: e.course.title,
    at: e.completedAt as Date
  }));

  const recentActivity = [...feedLessonItems, ...feedCourseItems]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 10);

  return {
    department,
    kpis: {
      activeManagers,
      blockedManagers,
      pendingApplications,
      averageProgress: Math.round(avgAggregate._avg.progress ?? 0),
      coursesCompletedRecent,
      lessonsCompletedRecent,
      period,
      rangeStart: isCustomRange ? periodStart : null,
      rangeEnd: isCustomRange && toDate ? toDate : null,
      isCustomRange
    },
    courses: courseEfficiency,
    topCourses,
    worstCourses,
    stuckManagers,
    activity,
    recentActivity
  };
}
