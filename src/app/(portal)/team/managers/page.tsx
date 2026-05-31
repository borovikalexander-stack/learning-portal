import { Ban, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageReveal } from "@/components/motion/PageReveal";
import { StaggerReveal } from "@/components/motion/StaggerReveal";
import { Avatar } from "@/components/ui/Avatar";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { ropBlockManagerAction, ropUnblockManagerAction } from "@/lib/rop/users";

type TeamManagersPageProps = {
  searchParams: Promise<{ status?: string; q?: string }>;
};

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

function maxDate(dates: (Date | null | undefined)[]) {
  const ts = dates.flatMap((d) => (d ? [d.getTime()] : []));
  return ts.length === 0 ? null : new Date(Math.max(...ts));
}

function lastActivityText(date: Date | null) {
  if (!date) return "Не приступал";
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000)));
  return days === 0 ? "Сегодня" : `${days} дн назад`;
}

export default async function TeamManagersPage({ searchParams }: TeamManagersPageProps) {
  const session = await requireSession();
  if (session.role !== "ROP") redirect("/");

  const rop = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { departmentId: true, department: { select: { name: true } } }
  });
  if (!rop?.departmentId) {
    redirect("/profile");
  }

  const params = await searchParams;
  const filterStatus = params.status === "blocked" || params.status === "active" ? params.status : "all";
  const q = (params.q ?? "").trim();

  const where: import("@prisma/client").Prisma.UserWhereInput = {
    role: "MANAGER",
    departmentId: rop.departmentId,
    status:
      filterStatus === "all"
        ? { in: ["ACTIVE", "BLOCKED"] }
        : filterStatus === "active"
          ? "ACTIVE"
          : "BLOCKED"
  };

  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } }
    ];
  }

  const managers = await prisma.user.findMany({
    where,
    include: {
      courseAccesses: { select: { id: true } },
      enrollments: { select: { progress: true, updatedAt: true } },
      lessonProgress: { select: { completedAt: true } }
    }
  });

  const rows = managers
    .map((m) => ({
      id: m.id,
      firstName: m.firstName,
      lastName: m.lastName,
      email: m.email,
      avatarUrl: m.avatarUrl,
      status: m.status,
      assignedCourses: m.courseAccesses.length,
      completedCourses: m.enrollments.filter((e) => e.progress === 100).length,
      averageProgress: average(m.enrollments.map((e) => e.progress)),
      lastActivityAt: maxDate([
        ...m.enrollments.map((e) => e.updatedAt),
        ...m.lessonProgress.map((p) => p.completedAt)
      ])
    }))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "ACTIVE" ? -1 : 1;
      return (b.lastActivityAt?.getTime() ?? 0) - (a.lastActivityAt?.getTime() ?? 0);
    });

  const filtersApplied = filterStatus !== "all" || q.length > 0;

  return (
    <PageReveal className="stack">
      <div data-reveal>
      <PageHeader
        breadcrumbs={[{ label: "Дашборд", href: "/team" }, { label: "Менеджеры" }]}
        eyebrow={rop.department?.name ?? "Отдел"}
        title="Менеджеры отдела"
      >
        <p className="text-muted">Прогресс, активность и доступы команды</p>
      </PageHeader>
      </div>

      <form className="filter-bar" action="/team/managers" method="GET" data-reveal>
        <input className="input" defaultValue={q} name="q" placeholder="Поиск по имени или email" type="search" />
        <select className="input" defaultValue={filterStatus} name="status">
          <option value="all">Все статусы</option>
          <option value="active">Активные</option>
          <option value="blocked">Заблокированные</option>
        </select>
        <button className="btn btn-primary" type="submit">Применить</button>
        {filtersApplied ? (
          <Link className="btn btn-ghost" href="/team/managers">Сбросить</Link>
        ) : null}
      </form>

      <section className="card stack motion-card" data-reveal>
        {rows.length === 0 ? (
          <div className="empty-state">
            <h3>Ничего не найдено</h3>
            <Link className="btn btn-ghost" href="/team/managers">Сбросить фильтры</Link>
          </div>
        ) : (
          <StaggerReveal itemSelector="tbody tr">
          <table className="data-table">
            <thead>
              <tr>
                <th>ФИО</th>
                <th>Статус</th>
                <th>Курсов</th>
                <th>Завершено</th>
                <th>Средний прогресс</th>
                <th>Последняя активность</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td>
                    <Link href={`/team/managers/${m.id}`} className="row" style={{ gap: 12, color: "inherit" }}>
                      <Avatar user={{ firstName: m.firstName, lastName: m.lastName, avatarUrl: m.avatarUrl }} size={36} />
                      <div>
                        <strong>{m.firstName} {m.lastName}</strong>
                        <div className="text-muted">{m.email}</div>
                      </div>
                    </Link>
                  </td>
                  <td><StatusBadge status={m.status} /></td>
                  <td>{m.assignedCourses}</td>
                  <td>{m.completedCourses}</td>
                  <td>
                    <div className="row">
                      <div className="progress-mini">
                        <span style={{ width: `${m.averageProgress}%` }} />
                      </div>
                      <span>{m.averageProgress}%</span>
                    </div>
                  </td>
                  <td>{lastActivityText(m.lastActivityAt)}</td>
                  <td>
                    <div className="table-actions">
                      {m.status === "ACTIVE" ? (
                        <form action={ropBlockManagerAction}>
                          <input name="userId" type="hidden" value={m.id} />
                          <button className="btn btn-icon btn-ghost btn-danger" title="Заблокировать" type="submit">
                            <Ban size={16} />
                          </button>
                        </form>
                      ) : (
                        <form action={ropUnblockManagerAction}>
                          <input name="userId" type="hidden" value={m.id} />
                          <button className="btn btn-icon btn-ghost" title="Разблокировать" type="submit">
                            <CheckCircle2 size={16} />
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </StaggerReveal>
        )}
      </section>
    </PageReveal>
  );
}
