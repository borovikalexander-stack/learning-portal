import { redirect } from "next/navigation";
import { PageReveal } from "@/components/motion/PageReveal";
import { StaggerReveal } from "@/components/motion/StaggerReveal";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { ropApproveUserAction, ropRejectUserAction } from "@/lib/rop/users";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export default async function TeamApplicationsPage() {
  const session = await requireSession();
  if (session.role !== "ROP") redirect("/");

  const rop = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { department: { select: { name: true, slug: true } } }
  });
  if (!rop?.department) redirect("/profile");

  const applications = await prisma.user.findMany({
    where: { status: "PENDING", requestedDept: rop.department.slug, onboardingStatus: "ACCEPTED" },
    orderBy: { createdAt: "asc" }
  });

  return (
    <PageReveal className="stack">
      <div data-reveal>
      <PageHeader
        breadcrumbs={[{ label: "Дашборд", href: "/team" }, { label: "Заявки" }]}
        eyebrow={rop.department.name}
        title="Заявки на доступ"
      >
        <p className="text-muted">Подтвердите или отклоните вступление в отдел</p>
      </PageHeader>
      </div>

      {applications.length === 0 ? (
        <section className="card stack motion-card" data-reveal>
          <div className="empty-state">
            <h3>Новых заявок нет</h3>
            <p className="text-muted">Сюда попадут менеджеры, выбравшие ваш отдел при регистрации</p>
          </div>
        </section>
      ) : (
        <section className="card stack motion-card" data-reveal>
          <StaggerReveal itemSelector="tbody tr">
          <table className="data-table">
            <thead>
              <tr>
                <th>ФИО</th>
                <th>Email</th>
                <th>Дата подачи</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.firstName} {user.lastName}</strong>
                    {user.declinedOnboardingBefore ? (
                      <div style={{ marginTop: 6 }}>
                        <span className="badge badge-warning">Ранее отказывался</span>
                      </div>
                    ) : null}
                  </td>
                  <td>{user.email}</td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>
                    <div className="row">
                      <form action={ropApproveUserAction}>
                        <input name="userId" type="hidden" value={user.id} />
                        <button className="btn btn-accent" type="submit">Одобрить</button>
                      </form>
                      <form action={ropRejectUserAction}>
                        <input name="userId" type="hidden" value={user.id} />
                        <button className="btn btn-danger" type="submit">Отклонить</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </StaggerReveal>
        </section>
      )}
    </PageReveal>
  );
}
