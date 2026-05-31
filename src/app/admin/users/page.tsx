import { Ban, CheckCircle2, Trash2 } from "lucide-react";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { PageReveal } from "@/components/motion/PageReveal";
import { StaggerReveal } from "@/components/motion/StaggerReveal";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  approveUserAction,
  blockUserAction,
  deleteUserAction,
  rejectUserAction,
  unblockUserAction
} from "@/lib/admin/users";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

type AdminUsersPageProps = {
  searchParams: Promise<{
    dept?: string;
    role?: string;
    status?: string;
    q?: string;
  }>;
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

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function maxDate(dates: (Date | null | undefined)[]) {
  const timestamps = dates.flatMap((date) => (date ? [date.getTime()] : []));

  if (timestamps.length === 0) {
    return null;
  }

  return new Date(Math.max(...timestamps));
}

function lastActivityText(date: Date | null) {
  if (!date) {
    return "Не приступал";
  }

  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000)));

  return days === 0 ? "Сегодня" : `${days} дн назад`;
}

function normalizeDept(value: string | undefined, validSlugs: string[]) {
  if (value === "none" || value === "all") return value;
  if (value && validSlugs.includes(value)) return value;
  return "all";
}

function normalizeStatus(value?: string) {
  return value === "active" || value === "blocked" || value === "pending" ? value : "all";
}

function normalizeRole(value?: string) {
  return value === "manager" || value === "rop" || value === "admin" ? value : "all";
}

function roleLabel(role: string) {
  if (role === "ADMIN") return "Админ";
  if (role === "ROP") return "РОП";
  return "Менеджер";
}

function roleBadgeClass(role: string) {
  if (role === "ADMIN") return "badge badge-dark";
  if (role === "ROP") return "badge badge-accent";
  return "badge";
}

function hasFilters(filterDept: string, filterStatus: string, filterRole: string, q: string) {
  return filterDept !== "all" || filterStatus !== "all" || filterRole !== "all" || q.length > 0;
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const session = await requireAdmin();
  const params = await searchParams;
  const departmentsAll = await prisma.department.findMany({ orderBy: { name: "asc" } });
  const departmentLabels: Record<string, string> = Object.fromEntries(departmentsAll.map((d) => [d.slug, d.name]));
  const filterDept = normalizeDept(params.dept, departmentsAll.map((d) => d.slug));
  const filterStatus = normalizeStatus(params.status);
  const filterRole = normalizeRole(params.role);
  const q = (params.q ?? "").trim();

  const managerWhere: Prisma.UserWhereInput = {
    role:
      filterRole === "manager"
        ? "MANAGER"
        : filterRole === "rop"
          ? "ROP"
          : filterRole === "admin"
            ? "ADMIN"
            : { in: ["MANAGER", "ROP", "ADMIN"] },
    status:
      filterStatus === "all"
        ? { in: ["ACTIVE", "BLOCKED"] }
        : filterStatus === "active"
          ? "ACTIVE"
          : filterStatus === "blocked"
            ? "BLOCKED"
            : "PENDING"
  };

  if (filterDept === "none") {
    managerWhere.departmentId = null;
  } else if (filterDept !== "all") {
    managerWhere.department = { slug: filterDept };
  }

  if (q) {
    managerWhere.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } }
    ];
  }

  const staffRoleWhere: Prisma.UserWhereInput = { role: { in: ["MANAGER", "ROP", "ADMIN"] } };

  const [pendingUsers, managers, totalStaff, activeStaff, blockedStaff] = await Promise.all([
    prisma.user.findMany({
      where: { status: "PENDING", onboardingStatus: "ACCEPTED" },
      orderBy: { createdAt: "asc" }
    }),
    prisma.user.findMany({
      where: managerWhere,
      include: {
        department: true,
        courseAccesses: { select: { id: true } },
        enrollments: { select: { progress: true, updatedAt: true } },
        lessonProgress: { select: { completedAt: true } }
      }
    }),
    prisma.user.count({ where: { ...staffRoleWhere, status: { in: ["ACTIVE", "BLOCKED"] } } }),
    prisma.user.count({ where: { ...staffRoleWhere, status: "ACTIVE" } }),
    prisma.user.count({ where: { ...staffRoleWhere, status: "BLOCKED" } })
  ]);
  const departments = departmentsAll;

  const managerRows = managers
    .map((manager) => {
      const lastActivityAt = maxDate([
        ...manager.enrollments.map((enrollment) => enrollment.updatedAt),
        ...manager.lessonProgress.map((progress) => progress.completedAt)
      ]);

      return {
        id: manager.id,
        firstName: manager.firstName,
        lastName: manager.lastName,
        email: manager.email,
        role: manager.role,
        status: manager.status,
        departmentName: manager.department?.name ?? "Без отдела",
        assignedCourses: manager.courseAccesses.length,
        completedCourses: manager.enrollments.filter((enrollment) => enrollment.progress === 100).length,
        averageProgress: average(manager.enrollments.map((enrollment) => enrollment.progress)),
        lastActivityAt
      };
    })
    .sort((left, right) => {
      if (left.status !== right.status) {
        if (left.status === "PENDING") return -1;
        if (right.status === "PENDING") return 1;
        return left.status === "ACTIVE" ? -1 : 1;
      }

      return (right.lastActivityAt?.getTime() ?? 0) - (left.lastActivityAt?.getTime() ?? 0);
    });

  const filtersApplied = hasFilters(filterDept, filterStatus, filterRole, q);

  return (
    <PageReveal className="stack">
      <div className="stack">
      <div data-reveal>
      <PageHeader eyebrow="Команда" title="Сотрудники">
        <p className="text-muted">
          {activeStaff} активных сотрудников, {blockedStaff} заблокированных, {pendingUsers.length} в заявках
        </p>
      </PageHeader>
      </div>

      <form action="/admin/users" className="filter-bar" data-reveal method="GET">
        <input className="input" defaultValue={q} name="q" placeholder="Поиск по имени или email" type="search" />
        <select className="input" defaultValue={filterStatus} name="status">
          <option value="all">Все статусы</option>
          <option value="active">Активные</option>
          <option value="blocked">Заблокированные</option>
        </select>
        <select className="input" defaultValue={filterDept} name="dept">
          <option value="all">Все отделы</option>
          {departments.map((department) => (
            <option key={department.id} value={department.slug}>
              {department.name}
            </option>
          ))}
          <option value="none">Без отдела</option>
        </select>
        <select className="input" defaultValue={filterRole} name="role">
          <option value="all">Все роли</option>
          <option value="manager">Менеджеры</option>
          <option value="rop">РОП</option>
          <option value="admin">Администраторы</option>
        </select>
        <button className="btn btn-primary" type="submit">
          Применить
        </button>
        {filtersApplied ? (
          <Link className="btn btn-ghost" href="/admin/users">
            Сбросить
          </Link>
        ) : null}
      </form>

      {pendingUsers.length > 0 ? (
        <section className="card stack motion-card" data-reveal id="applications">
          <div>
            <h2>Заявки на доступ</h2>
            <p className="text-muted">Проверьте отдел и подтвердите доступ к обучению</p>
          </div>
          <StaggerReveal itemSelector="tbody tr">
          <table className="data-table">
            <thead>
              <tr>
                <th>ФИО</th>
                <th>Email</th>
                <th>Запрошенный отдел</th>
                <th>Дата подачи</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {pendingUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>
                      {user.firstName} {user.lastName}
                    </strong>
                    {user.declinedOnboardingBefore ? (
                      <div style={{ marginTop: 6 }}>
                        <span className="badge badge-warning">Ранее отказывался</span>
                      </div>
                    ) : null}
                  </td>
                  <td>{user.email}</td>
                  <td>{user.requestedDept ? departmentLabels[user.requestedDept] ?? user.requestedDept : "Не указан"}</td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>
                    <div className="row">
                      <form action={approveUserAction}>
                        <input name="userId" type="hidden" value={user.id} />
                        <button className="btn btn-accent" type="submit">
                          Одобрить
                        </button>
                      </form>
                      <form action={rejectUserAction}>
                        <input name="userId" type="hidden" value={user.id} />
                        <button className="btn btn-danger" type="submit">
                          Отклонить
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </StaggerReveal>
        </section>
      ) : null}

      <section className="card stack motion-card" data-reveal>
        <div>
          <h2>Все сотрудники</h2>
          <p className="text-muted">
            {filtersApplied ? `${managerRows.length} из ${totalStaff}` : "Общий прогресс, назначенные курсы и последняя активность"}
          </p>
        </div>
        {managerRows.length === 0 ? (
          <div className="empty-state">
            <h3>Ничего не найдено по выбранным фильтрам</h3>
            <Link className="btn btn-ghost" href="/admin/users">
              Сбросить фильтры
            </Link>
          </div>
        ) : (
          <>
            <StaggerReveal itemSelector="tbody tr">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ФИО</th>
                  <th>Роль</th>
                  <th>Отдел</th>
                  <th>Статус</th>
                  <th>Курсов</th>
                  <th>Завершено</th>
                  <th>Средний прогресс</th>
                  <th>Последняя активность</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {managerRows.map((manager) => (
                  <tr key={manager.id}>
                    <td>
                      <Link href={`/admin/users/${manager.id}`}>
                        <strong>
                          {manager.firstName} {manager.lastName}
                        </strong>
                      </Link>
                      <div className="text-muted">{manager.email}</div>
                    </td>
                    <td>
                      <span className={roleBadgeClass(manager.role)}>{roleLabel(manager.role)}</span>
                    </td>
                    <td>{manager.departmentName}</td>
                    <td>
                      <StatusBadge status={manager.status} />
                    </td>
                    <td>{manager.assignedCourses}</td>
                    <td>{manager.completedCourses}</td>
                    <td>
                      <div className="row">
                        <div className="progress-mini">
                          <span style={{ width: `${manager.averageProgress}%` }} />
                        </div>
                        <span>{manager.averageProgress}%</span>
                      </div>
                    </td>
                    <td>{lastActivityText(manager.lastActivityAt)}</td>
                    <td>
                      <div className="table-actions">
                        {manager.status === "ACTIVE" ? (
                          <form action={blockUserAction}>
                            <input name="userId" type="hidden" value={manager.id} />
                            <button className="btn btn-icon btn-ghost btn-danger" title="Заблокировать" type="submit">
                              <Ban size={16} />
                            </button>
                          </form>
                        ) : null}
                        {manager.status === "BLOCKED" ? (
                          <form action={unblockUserAction}>
                            <input name="userId" type="hidden" value={manager.id} />
                            <button className="btn btn-icon btn-ghost" title="Разблокировать" type="submit">
                              <CheckCircle2 size={16} />
                            </button>
                          </form>
                        ) : null}
                        {manager.id !== session.userId ? (
                          <form action={deleteUserAction}>
                            <input name="userId" type="hidden" value={manager.id} />
                            <button className="btn btn-icon btn-ghost btn-danger" title="Удалить" type="submit">
                              <Trash2 size={16} />
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </StaggerReveal>
            <p className="text-muted">Удаление безвозвратно удалит пользователя и весь его прогресс.</p>
          </>
        )}
      </section>
      </div>
    </PageReveal>
  );
}
