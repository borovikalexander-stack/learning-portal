import { Ban, CheckCircle2, Circle, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ScrollReveal } from "@/components/motion/ScrollReveal";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { grantCourseAccessAction, revokeCourseAccessAction } from "@/lib/admin/access";
import { getManagerProfile } from "@/lib/admin/analytics";
import {
  blockUserAction,
  deleteUserAction,
  unblockUserAction,
  updateUserDepartmentAction,
  updateUserRoleAction
} from "@/lib/admin/users";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

type AdminUserDetailPageProps = {
  params: Promise<{ userId: string }>;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function lastActivityText(date: Date | null) {
  if (!date) {
    return "Никогда";
  }

  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000)));

  return days === 0 ? "Сегодня" : `${days} дн назад`;
}

function accessBadge(source: "DEPARTMENT_DEFAULT" | "MANUAL_GRANT") {
  return source === "DEPARTMENT_DEFAULT" ? (
    <span className="badge badge-accent">Курс отдела</span>
  ) : (
    <span className="badge">Назначен вручную</span>
  );
}

export default async function AdminUserDetailPage({ params }: AdminUserDetailPageProps) {
  const session = await requireAdmin();
  const { userId } = await params;

  const [roleInfo, departments, profileResult] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, departmentId: true }
    }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    getManagerProfile(userId).catch((error: unknown) => {
      if (error instanceof Error && error.message === "USER_NOT_FOUND") {
        return null;
      }

      throw error;
    })
  ]);

  if (!profileResult || !roleInfo) {
    notFound();
  }

  const profile = profileResult;
  const isSelf = session.userId === profile.user.id;
  const canMutateUser = !isSelf;

  return (
    <div className="stack">
      <PageHeader
        actions={
          <div className="row">
            <Link className="btn btn-secondary" href="/admin/users">
              ← К списку
            </Link>
            {canMutateUser && profile.user.status === "ACTIVE" ? (
              <form action={blockUserAction}>
                <input name="userId" type="hidden" value={profile.user.id} />
                <button className="btn btn-secondary" type="submit">
                  <Ban size={16} />
                  Заблокировать
                </button>
              </form>
            ) : null}
            {canMutateUser && profile.user.status === "BLOCKED" ? (
              <form action={unblockUserAction}>
                <input name="userId" type="hidden" value={profile.user.id} />
                <button className="btn btn-secondary" type="submit">
                  <CheckCircle2 size={16} />
                  Разблокировать
                </button>
              </form>
            ) : null}
            {canMutateUser ? (
              <form action={deleteUserAction}>
                <input name="userId" type="hidden" value={profile.user.id} />
                <button className="btn btn-ghost btn-danger" type="submit">
                  <Trash2 size={16} />
                  Удалить
                </button>
              </form>
            ) : null}
          </div>
        }
        breadcrumbs={[
          { label: "Менеджеры", href: "/admin/users" },
          { label: `${profile.user.firstName} ${profile.user.lastName}` }
        ]}
        eyebrow="Менеджер"
        title={`${profile.user.firstName} ${profile.user.lastName}`}
      >
        <p className="text-muted">
          {profile.user.email} · {profile.user.departmentName ?? "Без отдела"}
        </p>
      </PageHeader>

      <section className="grid grid-2">
        <article className="card stack">
          <div>
            <h3>Профиль</h3>
            <p className="text-muted">Основные данные менеджера</p>
          </div>
          <dl className="profile-list">
            <div>
              <dt>Email</dt>
              <dd>{profile.user.email}</dd>
            </div>
            <div>
              <dt>Роль</dt>
              <dd>{roleInfo.role === "ROP" ? "РОП" : roleInfo.role === "MANAGER" ? "Менеджер" : roleInfo.role}</dd>
            </div>
            <div>
              <dt>Статус</dt>
              <dd>
                <StatusBadge status={profile.user.status} />
              </dd>
            </div>
            <div>
              <dt>Отдел</dt>
              <dd>{profile.user.departmentName ?? "Без отдела"}</dd>
            </div>
            <div>
              <dt>Дата регистрации</dt>
              <dd>{formatDate(profile.user.createdAt)}</dd>
            </div>
            <div>
              <dt>Последняя активность</dt>
              <dd>{lastActivityText(profile.user.lastActivityAt)}</dd>
            </div>
          </dl>
        </article>

        <article className="card">
          <div className="grid grid-2">
            <div className="kpi accent">
              <span className="kpi-label">Назначено</span>
              <strong className="kpi-value">{profile.kpis.assigned}</strong>
              <span className="kpi-hint">Курсов в доступе</span>
            </div>
            <div className="kpi">
              <span className="kpi-label">Завершено</span>
              <strong className="kpi-value">{profile.kpis.completed}</strong>
              <span className="kpi-hint">Курсов полностью</span>
            </div>
            <div className="kpi blue">
              <span className="kpi-label">Средний прогресс</span>
              <strong className="kpi-value">{profile.kpis.averageProgress}%</strong>
              <span className="kpi-hint">По всем назначениям</span>
            </div>
            <div className="kpi yellow">
              <span className="kpi-label">Уроков пройдено</span>
              <strong className="kpi-value">{profile.kpis.lessonsCompleted}</strong>
              <span className="kpi-hint">Факт прохождения</span>
            </div>
          </div>
        </article>
      </section>

      <ScrollReveal className="stack">
      <section className="card stack" data-scroll-reveal>
        <div>
          <h3>Настройки пользователя</h3>
          <p className="text-muted">Роль и отдел влияют на главный экран и дефолтные курсы</p>
        </div>

        <div className="settings-row">
          <div className="settings-row-info">
            <h4>Роль</h4>
            <p className="text-muted">Меняет набор функций и главный экран пользователя</p>
          </div>
          {isSelf ? (
            <span className="badge">Свою роль изменить нельзя</span>
          ) : roleInfo.role === "CURATOR" ? (
            <span className="badge">Роль управляется через БД</span>
          ) : (
            <form action={updateUserRoleAction} className="settings-row-form">
              <input name="userId" type="hidden" value={profile.user.id} />
              <select className="select" defaultValue={roleInfo.role} id="role" name="role" aria-label="Роль">
                <option value="MANAGER">Менеджер</option>
                <option value="ROP">РОП (руководитель отдела)</option>
                <option value="ADMIN">Администратор</option>
              </select>
              <button className="btn btn-primary btn-sm" type="submit">
                Сохранить
              </button>
            </form>
          )}
        </div>

        <div className="settings-row">
          <div className="settings-row-info">
            <h4>Отдел</h4>
            <p className="text-muted">
              Смена отдела автоматически обновит дефолтные доступы к курсам. Ручные назначения сохранятся.
            </p>
          </div>
          {roleInfo.role === "ADMIN" ? (
            <span className="badge">У администратора нет отдела</span>
          ) : (
            <form action={updateUserDepartmentAction} className="settings-row-form">
              <input name="userId" type="hidden" value={profile.user.id} />
              <select
                className="select"
                defaultValue={roleInfo.departmentId ?? ""}
                id="departmentId"
                name="departmentId"
                aria-label="Отдел"
              >
                <option value="">Без отдела</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
              <button className="btn btn-primary btn-sm" type="submit">
                Сохранить
              </button>
            </form>
          )}
        </div>
      </section>

      <section className="card stack" data-scroll-reveal>
        <div>
          <h3>Прогресс по курсам</h3>
          <p className="text-muted">Курсы, уроки и фактические отметки прохождения</p>
        </div>
        {profile.courses.length === 0 ? (
          <p className="text-muted">Курсы пока не назначены.</p>
        ) : (
          profile.courses.map((course) => (
            <article className="course-progress-row" key={course.id}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                <div className="row">
                  <span className="accent-dot" style={{ background: course.accent }} />
                  <div>
                    <strong>{course.title}</strong>
                    <p className="text-muted">{course.departmentName}</p>
                  </div>
                </div>
                <div className="row">
                  {accessBadge(course.accessSource)}
                  <strong>{course.progressPercent}%</strong>
                </div>
              </div>
              <div className="progress" style={{ marginTop: 12 }}>
                <span style={{ background: course.accent, width: `${course.progressPercent}%` }} />
              </div>
              <div className="lesson-status-list">
                {course.lessons.map((lesson) => (
                  <span className={`lesson-pill ${lesson.isCompleted ? "completed" : ""}`} key={lesson.id}>
                    {lesson.isCompleted ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                    Урок {lesson.order}: {lesson.title}
                  </span>
                ))}
              </div>
            </article>
          ))
        )}
      </section>

      <section className="card stack" data-scroll-reveal>
        <div>
          <h3>История прохождения</h3>
          <p className="text-muted">Последние 20 событий по урокам и курсам</p>
        </div>
        {profile.history.length === 0 ? (
          <p className="text-muted">Активности пока не было.</p>
        ) : (
          <ul className="history-list">
            {profile.history.map((event, index) => (
              <li key={`${event.type}-${event.at.toISOString()}-${index}`}>
                {event.type === "lesson" ? (
                  <>
                    Урок «{event.lessonTitle}» в курсе «{event.courseTitle}» — {formatDate(event.at)}
                  </>
                ) : (
                  <>
                    Курс «{event.courseTitle}» завершен — {formatDate(event.at)}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card stack" data-scroll-reveal>
        <div>
          <h3>Управление доступом</h3>
          <p className="text-muted">Ручное назначение и снятие курсов</p>
        </div>
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
            {profile.courses.map((course) => (
              <tr key={course.id}>
                <td>
                  <strong>{course.title}</strong>
                  <div className="text-muted">{course.slug}</div>
                </td>
                <td>{course.departmentName}</td>
                <td>{accessBadge(course.accessSource)}</td>
                <td>
                  <form action={revokeCourseAccessAction}>
                    <input name="userId" type="hidden" value={profile.user.id} />
                    <input name="courseId" type="hidden" value={course.id} />
                    <button className="btn btn-ghost btn-sm btn-danger" type="submit">
                      Снять
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <form action={grantCourseAccessAction} className="form-inline">
          <input name="userId" type="hidden" value={profile.user.id} />
          <div className="field">
            <label htmlFor="courseId">Назначить курс</label>
            <select className="select" disabled={profile.availableCoursesToGrant.length === 0} id="courseId" name="courseId" required>
              {profile.availableCoursesToGrant.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.departmentName} · {course.title}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary btn-sm" disabled={profile.availableCoursesToGrant.length === 0} type="submit">
            Назначить
          </button>
        </form>
        {profile.availableCoursesToGrant.length === 0 ? (
          <p className="text-muted">Все опубликованные курсы уже назначены этому менеджеру.</p>
        ) : null}
      </section>
      </ScrollReveal>
    </div>
  );
}
