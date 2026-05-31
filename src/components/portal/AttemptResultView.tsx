import { CheckCircle2, Clock, XCircle } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { PageReveal } from "@/components/motion/PageReveal";
import { StaggerReveal } from "@/components/motion/StaggerReveal";
import type { AttemptResult } from "@/lib/portal/testing";

type Props = {
  result: AttemptResult;
  backHref: string;
  retryHref: string | null;
};

function renderAnswerValue(type: string, value: unknown, options: unknown): string {
  if (type === "TEXT") {
    if (value && typeof value === "object" && "text" in value) {
      return String((value as { text: unknown }).text ?? "");
    }
    return "";
  }
  if (type === "SINGLE_CHOICE") {
    if (!value || typeof value !== "object" || !("value" in value)) return "—";
    const idx = Number((value as { value: unknown }).value);
    if (!Array.isArray(options)) return `${idx}`;
    return String(options[idx] ?? `вариант ${idx + 1}`);
  }
  if (type === "MULTIPLE_CHOICE") {
    if (!value || typeof value !== "object" || !("value" in value)) return "—";
    const arr = (value as { value: unknown }).value;
    if (!Array.isArray(arr)) return "—";
    if (!Array.isArray(options)) return arr.join(", ");
    return arr.map((i) => String(options[Number(i)] ?? `вариант ${Number(i) + 1}`)).join(", ");
  }
  if (type === "MATCHING") {
    if (!value || typeof value !== "object" || !("value" in value)) return "—";
    const pairs = (value as { value: unknown }).value;
    if (!pairs || typeof pairs !== "object") return "—";
    const opts = options as { left?: unknown[]; right?: unknown[] } | null;
    if (!opts || !Array.isArray(opts.left) || !Array.isArray(opts.right)) return "—";
    return Object.entries(pairs as Record<string, unknown>)
      .map(([li, ri]) => {
        const l = String(opts.left?.[Number(li)] ?? li);
        const r = String(opts.right?.[Number(ri)] ?? ri);
        return `${l} → ${r}`;
      })
      .join("; ");
  }
  return "—";
}

export function AttemptResultView({ result, backHref, retryHref }: Props) {
  const { attempt, test, totalAttempts, questions } = result;
  const attemptsLeft = test.maxAttempts - totalAttempts;
  const hasPending = attempt.reviewStatus === "PENDING";

  return (
    <PageReveal className="stack">
      <section className={`card stack motion-card ${attempt.passed ? "card-accent" : hasPending ? "card-yellow" : ""}`} data-reveal>
        <div className="row" style={{ gap: 16, alignItems: "center" }}>
          {attempt.passed ? (
            <CheckCircle2 size={48} />
          ) : hasPending ? (
            <Clock size={48} />
          ) : (
            <XCircle size={48} />
          )}
          <div>
            <h2>
              {attempt.passed
                ? "Тест пройден"
                : hasPending
                  ? "Ожидает проверки"
                  : "Тест не пройден"}
            </h2>
            <p>
              {attempt.scorePercent !== null
                ? `Автоматическая оценка: ${attempt.scorePercent}%`
                : "Откроется после проверки открытых ответов"}
              {" · "}проходной балл {test.passPercent}%
            </p>
          </div>
        </div>
        <p className="text-muted">
          Использовано попыток: {totalAttempts} из {test.maxAttempts}. Осталось: {Math.max(0, attemptsLeft)}.
        </p>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <Link className="btn btn-primary" href={backHref as Route}>
            Вернуться
          </Link>
          {!attempt.passed && retryHref && attemptsLeft > 0 ? (
            <Link className="btn btn-secondary" href={retryHref as Route}>
              Пройти снова
            </Link>
          ) : null}
        </div>
      </section>

      <section className="card stack motion-card" data-reveal>
        <h3>Разбор ответов</h3>
        <StaggerReveal className="stack">
        {questions.map((q, idx) => {
          const userAnswer = renderAnswerValue(q.type, q.answerValue, q.options);
          const isText = q.type === "TEXT";
          const reviewClass =
            q.isCorrect === true
              ? "badge-accent"
              : q.isCorrect === false
                ? "badge-danger"
                : q.reviewStatus === "APPROVED"
                  ? "badge-accent"
                  : q.reviewStatus === "REJECTED"
                    ? "badge-danger"
                    : "badge-yellow";
          const reviewLabel =
            q.isCorrect === true
              ? "Верно"
              : q.isCorrect === false
                ? "Неверно"
                : q.reviewStatus === "APPROVED"
                  ? "Принят"
                  : q.reviewStatus === "REJECTED"
                    ? "Отклонён"
                    : "На проверке";

          return (
            <div className="answer-review" data-stagger-item key={q.id}>
              <div className="row" style={{ gap: 12, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <p className="text-muted small">Вопрос {idx + 1} · {q.points} {q.points === 1 ? "балл" : "баллов"}</p>
                  <strong>{q.prompt}</strong>
                </div>
                <span className={`badge ${reviewClass}`}>{reviewLabel}</span>
              </div>
              <div className="answer-review-body">
                <p className="text-muted small">Ваш ответ:</p>
                <p>{userAnswer || <em>пустой ответ</em>}</p>
              </div>
              {isText && q.reviewComment ? (
                <div className="answer-review-body">
                  <p className="text-muted small">Комментарий проверяющего:</p>
                  <p>{q.reviewComment}</p>
                </div>
              ) : null}
            </div>
          );
        })}
        </StaggerReveal>
      </section>
    </PageReveal>
  );
}
