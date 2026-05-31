import Link from "next/link";
import { redirect } from "next/navigation";
import { PageReveal } from "@/components/motion/PageReveal";
import { StaggerReveal } from "@/components/motion/StaggerReveal";
import { Avatar } from "@/components/ui/Avatar";
import { PageHeader } from "@/components/ui/PageHeader";
import { reviewAnswerAction } from "@/lib/admin/review";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function renderUserText(value: unknown): string {
  if (value && typeof value === "object" && "text" in value) {
    return String((value as { text: unknown }).text ?? "");
  }
  return "";
}

export default async function TeamReviewPage() {
  const session = await requireSession();
  if (session.role !== "ROP") redirect("/");

  const rop = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { departmentId: true, department: { select: { name: true } } }
  });
  if (!rop?.departmentId) redirect("/profile");

  const pendingAnswers = await prisma.answerAttempt.findMany({
    where: {
      reviewStatus: "PENDING",
      question: { type: "TEXT" },
      attempt: { user: { departmentId: rop.departmentId } }
    },
    orderBy: { attempt: { submittedAt: "asc" } },
    include: {
      question: { select: { prompt: true, points: true } },
      attempt: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          test: { select: { title: true, course: { select: { title: true, slug: true } }, lesson: { select: { title: true, id: true } } } }
        }
      }
    }
  });

  return (
    <PageReveal className="stack">
      <div data-reveal>
      <PageHeader
        breadcrumbs={[{ label: "Дашборд", href: "/team" }, { label: "Проверка ответов" }]}
        eyebrow={rop.department?.name ?? "Отдел"}
        title="Проверка открытых ответов"
      >
        <p className="text-muted">Открытые ответы тестов от менеджеров вашего отдела</p>
      </PageHeader>
      </div>

      {pendingAnswers.length === 0 ? (
        <section className="card stack motion-card" data-reveal>
          <div className="empty-state">
            <h3>Открытых ответов нет</h3>
            <p className="text-muted">Когда менеджеры пройдут тесты с открытыми ответами, они появятся здесь.</p>
          </div>
        </section>
      ) : (
        <StaggerReveal className="stack">
          {pendingAnswers.map((a) => {
            const userName = `${a.attempt.user.firstName} ${a.attempt.user.lastName}`;
            const userText = renderUserText(a.value);
            return (
              <article key={a.id} className="card stack motion-card" data-stagger-item>
                <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                  <div className="row" style={{ gap: 12 }}>
                    <Avatar user={a.attempt.user} size={40} />
                    <div>
                      <strong>{userName}</strong>
                      <div className="text-muted small">{formatDate(a.attempt.submittedAt)}</div>
                    </div>
                  </div>
                  <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                    <span className="badge">{a.attempt.test.course.title}</span>
                    {a.attempt.test.lesson ? <span className="badge badge-blue">Урок: {a.attempt.test.lesson.title}</span> : <span className="badge badge-accent">Итоговый</span>}
                    <span className="badge">{a.question.points} {a.question.points === 1 ? "балл" : "баллов"}</span>
                  </div>
                </div>

                <div className="answer-review-body">
                  <p className="text-muted small">Вопрос:</p>
                  <p><strong>{a.question.prompt}</strong></p>
                </div>

                <div className="answer-review-body">
                  <p className="text-muted small">Ответ менеджера:</p>
                  <p style={{ whiteSpace: "pre-wrap" }}>{userText || <em>пустой ответ</em>}</p>
                </div>

                <form action={reviewAnswerAction} className="stack">
                  <input type="hidden" name="answerAttemptId" value={a.id} />
                  <div className="field">
                    <label htmlFor={`comment-${a.id}`}>Комментарий (необязательно)</label>
                    <textarea className="textarea" id={`comment-${a.id}`} name="comment" rows={2} />
                  </div>
                  <div className="row" style={{ flexWrap: "wrap" }}>
                    <button className="btn btn-accent" name="decision" type="submit" value="approve">
                      Принять
                    </button>
                    <button className="btn btn-danger" name="decision" type="submit" value="reject">
                      Отклонить
                    </button>
                    <Link className="btn btn-ghost" href={`/team/managers/${a.attempt.user.id}`}>
                      Карточка менеджера
                    </Link>
                  </div>
                </form>
              </article>
            );
          })}
        </StaggerReveal>
      )}
    </PageReveal>
  );
}
