import { ArrowUpRight, BookOpenCheck, GraduationCap, TrendingDown, TrendingUp } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import { PageReveal } from "@/components/motion/PageReveal";
import { ScrollReveal } from "@/components/motion/ScrollReveal";
import { StaggerReveal } from "@/components/motion/StaggerReveal";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAdminDashboard, normalizePeriod, PERIOD_LABELS, type PeriodKey } from "@/lib/admin/analytics";
import { requireAdmin } from "@/lib/auth/session";

type AdminPageProps = {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
};

const PERIOD_ORDER: PeriodKey[] = ["7d", "30d", "90d", "all"];

const DEPT_VARIANTS: Record<string, { card: string; deptClass: string }> = {
  autopodbor: { card: "card card-blue dept-card", deptClass: "dept-card-on-blue" },
  import: { card: "card card-yellow dept-card", deptClass: "dept-card-on-yellow" }
};

function getDeptVariant(slug: string, index: number) {
  if (DEPT_VARIANTS[slug]) return DEPT_VARIANTS[slug];
  const fallbacks = [
    { card: "card card-blue dept-card", deptClass: "dept-card-on-blue" },
    { card: "card card-yellow dept-card", deptClass: "dept-card-on-yellow" },
    { card: "card card-accent dept-card", deptClass: "dept-card-on-accent" },
    { card: "card card-dark dept-card", deptClass: "dept-card-on-dark" }
  ];
  return fallbacks[index % fallbacks.length];
}

function toDateInput(date: Date | null) {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatRange(start: Date, end: Date | null) {
  const fmt = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
  if (!end) return `с ${fmt.format(start)}`;
  return `${fmt.format(start)} — ${fmt.format(end)}`;
}

function activityHeight(value: number, maxValue: number) {
  if (maxValue === 0) return 0;
  return Math.max(6, Math.round((value / maxValue) * 100));
}

function activityLabel(date: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit" }).format(new Date(`${date}T00:00:00`));
}

function lastActivityLabel(daysAgo: number | null) {
  return daysAgo === null ? "Не приступал" : `${daysAgo} дн назад`;
}

function relativeTime(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} дн назад`;
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit" }).format(date);
}

function buildPeriodHref(period: PeriodKey) {
  return period === "30d" ? "/admin" : `/admin?period=${period}`;
}

export default async function AdminDashboardPage({ searchParams }: AdminPageProps) {
  await requireAdmin();
  const params = await searchParams;
  const period = normalizePeriod(params.period);
  const dashboard = await getAdminDashboard({ period, from: params.from, to: params.to });

  const maxActivity = Math.max(...dashboard.activity.map((p) => p.lessonsCompleted + p.coursesCompleted), 0);
  const hasActivity = dashboard.activity.some((p) => p.lessonsCompleted > 0 || p.coursesCompleted > 0);

  const isCustomRange = dashboard.kpis.isCustomRange;
  const fromValue = isCustomRange ? toDateInput(dashboard.kpis.rangeStart) : "";
  const toValue = isCustomRange ? toDateInput(dashboard.kpis.rangeEnd) : "";

  const periodSuffix = isCustomRange && dashboard.kpis.rangeStart
    ? `${formatRange(dashboard.kpis.rangeStart, dashboard.kpis.rangeEnd)}`
    : period === "all"
      ? "За всё время"
      : `За ${PERIOD_LABELS[period].toLowerCase()}`;

  return (
    <PageReveal className="stack">
      <div className="stack">
      <div data-reveal>
      <PageHeader
        eyebrow="Управление"
        title="Аналитика обучения"
        actions={
          <Link className="badge badge-dark" href="/admin/users#applications">
            Заявок ожидает: {dashboard.kpis.pendingApplications}
          </Link>
        }
      >
        <p className="text-muted">Динамика прохождения, активность команды, эффективность курсов</p>
      </PageHeader>
      </div>

      <section className="period-bar" data-reveal>
        <div className="period-filter" role="group" aria-label="Период">
          {PERIOD_ORDER.map((p) => (
            <Link
              key={p}
              href={buildPeriodHref(p) as Route}
              className={!isCustomRange && p === period ? "active" : ""}
            >
              {PERIOD_LABELS[p]}
            </Link>
          ))}
        </div>
        <form className="period-range" action="/admin" method="GET">
          <div className="period-range-field">
            <label htmlFor="period-from">С</label>
            <input
              className="input input-sm"
              defaultValue={fromValue}
              id="period-from"
              max={toDateInput(new Date())}
              name="from"
              type="date"
            />
          </div>
          <div className="period-range-field">
            <label htmlFor="period-to">по</label>
            <input
              className="input input-sm"
              defaultValue={toValue}
              id="period-to"
              max={toDateInput(new Date())}
              name="to"
              type="date"
            />
          </div>
          <button className={`btn btn-sm ${isCustomRange ? "btn-accent" : "btn-secondary"}`} type="submit">
            Применить
          </button>
          {isCustomRange ? (
            <Link className="btn btn-sm btn-ghost" href="/admin">
              Сбросить
            </Link>
          ) : null}
        </form>
      </section>

      {/* KPI row */}
      <div className="section-label" data-reveal>
        {isCustomRange ? `Данные за ${periodSuffix}` : `Данные за ${PERIOD_LABELS[period].toLowerCase()}`}
      </div>
      <StaggerReveal className="grid grid-4">
        <article className="kpi motion-card" data-stagger-item>
          <span className="kpi-label">Средний прогресс</span>
          <AnimatedNumber className="kpi-value" suffix="%" value={dashboard.kpis.averageProgress} />
          <span className="kpi-hint">На текущий момент</span>
          <div className="kpi-chips">
            {dashboard.departments.map((dept) => (
              <span key={dept.id} className="kpi-chip">
                {dept.name}: {dashboard.kpis.averageProgressByDept[dept.slug] ?? 0}%
              </span>
            ))}
          </div>
        </article>

        <article className="kpi accent motion-card" data-stagger-item>
          <span className="kpi-label">Активных менеджеров</span>
          <AnimatedNumber className="kpi-value" value={dashboard.kpis.activeManagers} />
          <span className="kpi-hint">Сейчас</span>
          <div className="kpi-chips">
            {dashboard.departments.map((dept) => (
              <span key={dept.id} className="kpi-chip">
                {dept.name} · {dashboard.kpis.activeManagersByDept[dept.slug] ?? 0}
              </span>
            ))}
          </div>
        </article>

        <article className="kpi motion-card" data-stagger-item>
          <span className="kpi-label">Курсов завершено</span>
          <AnimatedNumber className="kpi-value" value={dashboard.kpis.coursesCompletedRecent} />
          <span className="kpi-hint">{periodSuffix}</span>
        </article>

        <article className="kpi blue motion-card" data-stagger-item>
          <span className="kpi-label">Уроков пройдено</span>
          <AnimatedNumber className="kpi-value" value={dashboard.kpis.lessonsCompletedRecent} />
          <span className="kpi-hint">{periodSuffix}</span>
        </article>
      </StaggerReveal>

      {/* Department cards */}
      <StaggerReveal className="dept-grid">
        {dashboard.departments.length === 0 ? (
          <div className="card">
            <p className="text-muted">Отделы не настроены</p>
          </div>
        ) : (
          dashboard.departments.map((dept, index) => {
            const variant = getDeptVariant(dept.slug, index);

            return (
              <article className={`${variant.card} motion-card`} data-stagger-item key={dept.id}>
                <div className="dept-card-head">
                  <div>
                    <div className="dept-card-title">{dept.name}</div>
                    <div className="dept-card-value">{dept.averageProgress}%</div>
                  </div>
                  <div className="dept-card-icon">
                    <GraduationCap size={22} />
                  </div>
                </div>
                <div className="dept-card-progress" aria-label={`Средний прогресс ${dept.averageProgress}%`}>
                  <span style={{ width: `${dept.averageProgress}%` }} />
                </div>
                <div className="dept-card-meta">
                  <span className="dept-card-meta-item">{dept.managersCount} {pluralManagers(dept.managersCount)}</span>
                  <span className="dept-card-meta-item">{dept.coursesCompleted} {pluralCourses(dept.coursesCompleted)}</span>
                  <span className="dept-card-meta-item">{dept.pendingApplications} {pluralApps(dept.pendingApplications)}</span>
                </div>
                <Link className="dept-card-link" href={`/admin/users?dept=${dept.slug}`}>
                  Открыть отдел <ArrowUpRight size={16} />
                </Link>
              </article>
            );
          })
        )}
      </StaggerReveal>

      {/* Activity chart */}
      <section className="card stack motion-card" data-reveal>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h3>{isCustomRange ? `Активность за ${periodSuffix}` : `Активность ${periodSuffix.toLowerCase()}`}</h3>
            <p className="text-muted">Пройденные уроки и завершённые курсы</p>
          </div>
          <div className="activity-legend">
            <span className="activity-legend-item">
              <span className="activity-legend-dot" style={{ background: "var(--accent)" }} /> Уроки
            </span>
            <span className="activity-legend-item">
              <span className="activity-legend-dot" style={{ background: "var(--accent-blue)" }} /> Курсы
            </span>
          </div>
        </div>
        {hasActivity ? (
          <div className="activity-chart">
            {dashboard.activity.map((point) => {
              const total = point.lessonsCompleted + point.coursesCompleted;
              const heightPercent = activityHeight(total, maxActivity);
              return (
                <div
                  className="activity-day-wrap"
                  key={point.date}
                  title={`${activityLabel(point.date)}: ${point.lessonsCompleted} уроков, ${point.coursesCompleted} курсов`}
                >
                  <div className="activity-bar" style={{ height: `${heightPercent}%` }}>
                    {point.lessonsCompleted > 0 ? (
                      <div className="activity-bar-lessons" style={{ flex: point.lessonsCompleted }} />
                    ) : null}
                    {point.coursesCompleted > 0 ? (
                      <div className="activity-bar-courses" style={{ flex: point.coursesCompleted }} />
                    ) : null}
                  </div>
                  <span className="activity-day-label">{activityLabel(point.date)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-muted">
            {isCustomRange ? `Активности за ${periodSuffix} пока нет` : `Активности ${periodSuffix.toLowerCase()} пока нет`}
          </p>
        )}
      </section>

      <ScrollReveal className="stack">
      {/* Top / Worst courses */}
      <section className="grid grid-2" data-scroll-reveal>
        <article className="card stack motion-card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <h3>Топ курсов</h3>
              <p className="text-muted">Лучший средний прогресс</p>
            </div>
            <span className="badge badge-accent">
              <TrendingUp size={13} /> топ
            </span>
          </div>
          {dashboard.topCourses.length === 0 ? (
            <p className="text-muted">Нет назначенных курсов</p>
          ) : (
            <div className="stack">
              {dashboard.topCourses.map((course, idx) => (
                <CourseLine key={course.id} course={course} rank={idx + 1} variant="top" />
              ))}
            </div>
          )}
        </article>

        <article className="card stack motion-card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <h3>Требуют внимания</h3>
              <p className="text-muted">Худший средний прогресс</p>
            </div>
            <span className="badge badge-danger">
              <TrendingDown size={13} /> низкий
            </span>
          </div>
          {dashboard.worstCourses.length === 0 ? (
            <p className="text-muted">Нет назначенных курсов</p>
          ) : (
            <div className="stack">
              {dashboard.worstCourses.map((course, idx) => (
                <CourseLine key={course.id} course={course} rank={idx + 1} variant="worst" />
              ))}
            </div>
          )}
        </article>
      </section>

      {/* Stuck managers */}
      <section className="card stack motion-card" data-scroll-reveal>
        <div>
          <h3>Зависшие менеджеры</h3>
          <p className="text-muted">Без активности более 7 дней или прогресс ниже 50%</p>
        </div>
        {dashboard.stuckManagers.length === 0 ? (
          <p className="text-muted">Все менеджеры в работе</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>ФИО</th>
                <th>Отдел</th>
                <th>Курсов</th>
                <th>Средний прогресс</th>
                <th>Последняя активность</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.stuckManagers.map((manager) => (
                <tr key={manager.id}>
                  <td>
                    <Link href={`/admin/users/${manager.id}`}>
                      <strong>
                        {manager.firstName} {manager.lastName}
                      </strong>
                    </Link>
                  </td>
                  <td>{manager.departmentName ?? "Без отдела"}</td>
                  <td>{manager.assignedCourses}</td>
                  <td>
                    <div className="row">
                      <div className="progress-mini">
                        <span style={{ width: `${manager.averageProgress}%` }} />
                      </div>
                      <span>{manager.averageProgress}%</span>
                    </div>
                  </td>
                  <td>{lastActivityLabel(manager.lastActivityDaysAgo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Recent activity feed */}
      <section className="card stack motion-card" data-scroll-reveal>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h3>Свежая активность</h3>
            <p className="text-muted">Последние действия команды</p>
          </div>
          <span className="badge">{dashboard.recentActivity.length}</span>
        </div>
        {dashboard.recentActivity.length === 0 ? (
          <p className="text-muted">Действий пока не было</p>
        ) : (
          <div className="feed-list">
            {dashboard.recentActivity.map((item) => (
              <Link key={item.id} className="feed-item" href={`/admin/users/${item.userId}`}>
                <Avatar
                  user={{ firstName: item.userFirstName, lastName: item.userLastName, avatarUrl: item.userAvatarUrl }}
                  size={36}
                />
                <div className="feed-item-body">
                  <strong>
                    {item.userFirstName} {item.userLastName}
                  </strong>
                  <div className="text-muted">
                    {item.type === "lesson" ? (
                      <>
                        прошёл урок <em>«{item.lessonTitle}»</em> в курсе «{item.courseTitle}»
                      </>
                    ) : (
                      <>
                        завершил курс <em>«{item.courseTitle}»</em>
                      </>
                    )}
                    {item.departmentName ? ` · ${item.departmentName}` : ""}
                  </div>
                </div>
                <span className="feed-item-time">{relativeTime(item.at)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
      </ScrollReveal>
      </div>
    </PageReveal>
  );
}

function CourseLine({
  course,
  rank,
  variant
}: {
  course: { id: string; title: string; departmentName: string; averageProgress: number; assigned: number; completed: number; accent: string };
  rank: number;
  variant: "top" | "worst";
}) {
  const rankStyle =
    variant === "top"
      ? { background: "var(--success-soft)", color: "var(--success-text)" }
      : { background: "var(--danger-soft)", color: "var(--danger)" };
  return (
    <Link href={`/admin/courses/${course.id}`} className="course-line">
      <div className="course-line-rank" style={rankStyle}>
        {rank}
      </div>
      <div className="course-line-body">
        <div className="row" style={{ gap: 8 }}>
          <span className="accent-dot" style={{ background: course.accent }} />
          <strong>{course.title}</strong>
        </div>
        <div className="text-muted small">
          <BookOpenCheck size={12} style={{ display: "inline", verticalAlign: "-1px", marginRight: 4 }} />
          {course.departmentName} · {course.assigned} назначено · {course.completed} завершили
        </div>
      </div>
      <div className="course-line-progress">
        <div className="progress-mini">
          <span style={{ width: `${course.averageProgress}%` }} />
        </div>
        <strong>{course.averageProgress}%</strong>
      </div>
    </Link>
  );
}

function pluralManagers(n: number) {
  const last = n % 10;
  const last2 = n % 100;
  if (last2 >= 11 && last2 <= 14) return "менеджеров";
  if (last === 1) return "менеджер";
  if (last >= 2 && last <= 4) return "менеджера";
  return "менеджеров";
}

function pluralCourses(n: number) {
  const last = n % 10;
  const last2 = n % 100;
  if (last2 >= 11 && last2 <= 14) return "курсов завершено";
  if (last === 1) return "курс завершён";
  if (last >= 2 && last <= 4) return "курса завершено";
  return "курсов завершено";
}

function pluralApps(n: number) {
  const last = n % 10;
  const last2 = n % 100;
  if (last2 >= 11 && last2 <= 14) return "заявок";
  if (last === 1) return "заявка";
  if (last >= 2 && last <= 4) return "заявки";
  return "заявок";
}
