import { Ban, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getManagerProfile } from "@/lib/admin/analytics";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { ropBlockManagerAction, ropGrantCourseAction, ropRevokeCourseAction, ropUnblockManagerAction } from "@/lib/rop/users";

type TeamManagerPageProps = {
  params: Promise<{ userId: string }>;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function lastActivityText(date: Date | null) {
  if (!date) return "Никогда";
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000)));
  return days === 0 ? "Сегодня" : `${days} дн назад`;
}

export default async function TeamManagerPage({ params }: TeamManagerPageProps) {
  const session = await requireSession();
  if (session.role !== "ROP") redirect("/");

  const { userId } = await params;

  const rop = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { departmentId: true, department: { select: { id: true, name: true } } }
  });
  if (!rop?.departmentId) redirect("/profile");

  const targetCheck = await prisma.user.findUnique({
    where: { id: userId },
    select: { departmentId: true, role: true }
  });

  if (!targetCheck || targetCheck.departmentId !== rop.departmentId || targetCheck.role !== "MANAGER") {
    notFound();
  }

  const profile = await getManagerProfile(userId);
  const availableForRop = profile.availableCoursesToGrant.filter((course) => course.departmentId === session.departmentId);
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true }
  });

  return (
    <div className="stack">
      <PageHeader
        actions={
          <div className="row">
            <Link className="btn btn-secondary" href="/team/managers">← К списку</Link>
            {profile.user.status === "ACTIVE" ? (
              <form action={ropBlockManagerAction}>
                <input name="userId" type="hidden" value={userId} />
                <button className="btn btn-secondary" type="submit">
                  <Ban size={16} /> Заблокировать
                </button>
              </form>
            ) : (
              <form action={ropUnblockManagerAction}>
                <input name="userId" type="hidden" value={userId} />
                <button className="btn btn-secondary" type="submit">
                  <CheckCircle2 size={16} /> Разблокировать
                </button>
              </form>
            )}
          </div>
        }
        breadcrumbs={[
          { label: "Дашборд", href: "/team" },
          { label: "Менеджеры", href: "/team/managers" },
          { label: `${profile.user.firstName} ${profile.user.lastName}` }
        ]}
        eyebrow="Менеджер"
        title={`${profile.user.firstName} ${profile.user.lastName}`}
      >
        <p className="text-muted">{profile.user.email}</p>
      </PageHeader>

      <section className="grid grid-2">
        <article className="card stack">
          <div className="row" style={{ gap: 16 }}>
            <Avatar user={{ firstName: profile.user.firstName, lastName: profile.user.lastName, avatarUrl: target?.avatarUrl ?? null }} size={64} />
            <div>
              <h3>Профиль</h3>
              <p className="text-muted">Основные данные менеджера</p>
            </div>
          </div>
          <dl className="profile-list">
            <div><dt>Email</dt><dd>{profile.user.email}</dd></div>
            <div><dt>Статус</dt><dd><StatusBadge status={profile.user.status} /></dd></div>
            <div><dt>Отдел</dt><dd>{profile.user.departmentName ?? "Без отдела"}</dd></div>
            <div><dt>Дата регистрации</dt><dd>{formatDate(profile.user.createdAt)}</dd></div>
            <div><dt>Последняя активность</dt><dd>{lastActivityText(profile.user.lastActivityAt)}</dd></div>
          </dl>
        </article>

        <article className="card">
          <div className="grid grid-2">
            <div className="kpi accent">
              <span className="kpi-label">Назначено</span>
              <strong className="kpi-value">{profile.kpis.assigned}</strong>
              <span className="kpi-hint">Курсов</span>
            </div>
            <div className="kpi">
              <span className="kpi-label">Завершено</span>
              <strong className="kpi-value">{profile.kpis.completed}</strong>
              <span className="kpi-hint">Со 100% прогрессом</span>
            </div>
            <div className="kpi blue">
              <span className="kpi-label">Средний прогресс</span>
              <strong className="kpi-value">{profile.kpis.averageProgress}%</strong>
              <span className="kpi-hint">По курсам</span>
            </div>
            <div className="kpi yellow">
              <span className="kpi-label">Уроков пройдено</span>
              <strong className="kpi-value">{profile.kpis.lessonsCompleted}</strong>
              <span className="kpi-hint">Всего</span>
            </div>
          </div>
        </article>
      </section>

      <section className="card stack">
        <div>
          <h3>Прогресс по курсам</h3>
          <p className="text-muted">Доступные курсы и пройденные уроки</p>
        </div>
        {profile.courses.length === 0 ? (
          <p className="text-muted">Курсов пока не назначено</p>
        ) : (
          profile.courses.map((course) => (
            <div className="course-progress-row" key={course.id}>
              <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div className="row" style={{ gap: 10 }}>
                  <span className="accent-dot" style={{ background: course.accent }} />
                  <strong>{course.title}</strong>
                  <span className="badge">{course.accessSource === "DEPARTMENT_DEFAULT" ? "Курс отдела" : "Назначен вручную"}</span>
                </div>
                <strong>{course.progressPercent}%</strong>
              </div>
              <div className="progress" style={{ marginTop: 8 }}>
                <span style={{ width: `${course.progressPercent}%` }} />
              </div>
              <div className="lesson-status-list">
                {course.lessons.map((lesson) => (
                  <span key={lesson.id} className={`lesson-pill ${lesson.isCompleted ? "completed" : ""}`}>
                    {lesson.isCompleted ? "✓" : "○"} {lesson.title}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      <section className="card stack">
        <div>
          <h3>Управление доступом</h3>
          <p className="text-muted">Текущие доступы и ручное назначение курсов</p>
        </div>
        {profile.courses.length === 0 ? (
          <p className="text-muted">Доступов пока нет</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Курс</th>
                <th>Отдел</th>
                <th>Источник</th>
                <th>Действие</th>
              </tr>
            </thead>
            <tbody>
              {profile.courses.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.title}</strong></td>
                  <td>{c.departmentName}</td>
                  <td>
                    <span className="badge">{c.accessSource === "DEPARTMENT_DEFAULT" ? "Курс отдела" : "Назначен вручную"}</span>
                  </td>
                  <td>
                    <form action={ropRevokeCourseAction}>
                      <input name="userId" type="hidden" value={userId} />
                      <input name="courseId" type="hidden" value={c.id} />
                      <button className="btn btn-ghost btn-sm btn-danger" type="submit">Снять</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {availableForRop.length > 0 ? (
          <form action={ropGrantCourseAction} className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <input name="userId" type="hidden" value={userId} />
            <select className="input" name="courseId" required style={{ flex: 1, minWidth: 240 }}>
              <option value="">Выберите курс отдела {rop.department?.name ?? ""}…</option>
              {availableForRop.map((c) => (
                <option key={c.id} value={c.id}>{c.title} · {c.departmentName}</option>
              ))}
            </select>
            <button className="btn btn-accent" type="submit">Назначить</button>
          </form>
        ) : (
          <p className="text-muted">Все опубликованные курсы отдела {rop.department?.name ?? ""} уже назначены</p>
        )}
      </section>

      <section className="card stack">
        <div>
          <h3>История прохождения</h3>
          <p className="text-muted">Последние 20 событий</p>
        </div>
        {profile.history.length === 0 ? (
          <p className="text-muted">Активности пока не было</p>
        ) : (
          <ul className="history-list">
            {profile.history.map((item, idx) => (
              <li key={`${item.type}-${idx}-${item.at.getTime()}`}>
                {item.type === "lesson" ? (
                  <>Урок «{item.lessonTitle}» в курсе «{item.courseTitle}»</>
                ) : (
                  <>Курс «{item.courseTitle}» завершён</>
                )}
                {" — "}
                {new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(item.at)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
