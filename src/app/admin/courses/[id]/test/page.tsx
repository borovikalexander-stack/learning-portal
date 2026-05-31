import { ChevronDown, ChevronUp, Edit2, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { QuestionForm } from "@/components/admin/QuestionForm";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  createQuestionAction,
  deleteQuestionAction,
  deleteTestAction,
  reorderQuestionAction,
  updateTestAction
} from "@/lib/admin/tests";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

type TestEditorPageProps = {
  params: Promise<{ id: string }>;
};

type QuestionForPreview = {
  id: string;
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TEXT" | "MATCHING";
  prompt: string;
  order: number;
  points: number;
  options: unknown;
  answerKey: unknown;
};

const typeLabels: Record<QuestionForPreview["type"], string> = {
  SINGLE_CHOICE: "Один вариант",
  MULTIPLE_CHOICE: "Несколько вариантов",
  TEXT: "Открытый ответ",
  MATCHING: "Сопоставление"
};

function balls(points: number) {
  if (points === 1) {
    return "1 балл";
  }

  if (points >= 2 && points <= 4) {
    return `${points} балла`;
  }

  return `${points} баллов`;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function getCorrectIndex(value: unknown) {
  if (value && typeof value === "object" && "correctIndex" in value) {
    const index = Number((value as { correctIndex: unknown }).correctIndex);
    return Number.isInteger(index) ? index : -1;
  }

  return -1;
}

function getCorrectIndices(value: unknown) {
  if (value && typeof value === "object" && "correctIndices" in value) {
    const indices = (value as { correctIndices: unknown }).correctIndices;
    return Array.isArray(indices) ? indices.map(Number).filter(Number.isInteger) : [];
  }

  return [];
}

function getPairs(value: unknown) {
  if (value && typeof value === "object" && "pairs" in value && typeof (value as { pairs: unknown }).pairs === "object") {
    return ((value as { pairs: Record<string, unknown> }).pairs ?? {}) as Record<string, unknown>;
  }

  return {};
}

function AnswerPreview({ question }: { question: QuestionForPreview }) {
  if (question.type === "TEXT") {
    return (
      <div className="answer-preview">
        <span className="badge badge-warning">Ручная проверка</span>
      </div>
    );
  }

  if (question.type === "MATCHING") {
    const options = question.options as { left?: unknown; right?: unknown } | null;
    const left = asStringArray(options?.left);
    const right = asStringArray(options?.right);
    const pairs = getPairs(question.answerKey);

    return (
      <div className="answer-preview">
        {left.map((leftItem, index) => {
          const rightIndex = Number(pairs[String(index)] ?? index);
          return (
            <span className="answer correct" key={`${leftItem}-${index}`}>
              {leftItem} → {right[rightIndex] ?? "—"}
            </span>
          );
        })}
      </div>
    );
  }

  const options = asStringArray(question.options);
  const correctIndex = getCorrectIndex(question.answerKey);
  const correctIndices = getCorrectIndices(question.answerKey);

  return (
    <div className="answer-preview">
      {options.map((option, index) => {
        const isCorrect = question.type === "SINGLE_CHOICE" ? correctIndex === index : correctIndices.includes(index);
        return (
          <span className={`answer ${isCorrect ? "correct" : "wrong"}`} key={`${option}-${index}`}>
            {isCorrect ? "✓" : "○"} {option}
          </span>
        );
      })}
    </div>
  );
}

export default async function TestEditorPage({ params }: TestEditorPageProps) {
  await requireAdmin();
  const { id } = await params;

  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      tests: {
        where: { lessonId: null },
        orderBy: { createdAt: "asc" },
        include: {
          _count: {
            select: { attempts: true }
          },
          questions: {
            orderBy: { order: "asc" }
          }
        }
      }
    }
  });

  if (!course) {
    notFound();
  }

  const test = course.tests[0];

  if (!test) {
    redirect(`/admin/courses/${id}`);
  }

  const attemptsCount = test._count.attempts;
  const isLocked = attemptsCount > 0;

  return (
    <div className="stack">
      <PageHeader
        actions={
          <Link className="btn btn-secondary" href={`/admin/courses/${course.id}`}>
            ← К курсу
          </Link>
        }
        breadcrumbs={[
          { label: "Курсы", href: "/admin/courses" },
          { label: course.title, href: `/admin/courses/${course.id}` },
          { label: "Тест" }
        ]}
        eyebrow="Итоговый тест"
        title="Редактор теста"
      >
        <p className="text-muted">
          {test.questions.length} вопросов · проходной {test.passPercent}%
        </p>
      </PageHeader>

      {isLocked ? (
        <section className="card row" style={{ alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
          <span className="badge badge-warning">Тест уже сдавали ({attemptsCount} попыток). Структура заблокирована.</span>
          <p className="text-muted">Удаление теста остается доступным, но сотрет все попытки и ответы менеджеров.</p>
        </section>
      ) : null}

      <div className="editor-grid">
        <div className="stack">
          <section className="card stack">
            <div>
              <h3>Параметры</h3>
              <p className="text-muted">Название, проходной балл и количество попыток</p>
            </div>
            <form action={updateTestAction} className="admin-form">
              <input name="testId" type="hidden" value={test.id} />
              <div className="field">
                <label htmlFor="test-title">Название теста</label>
                <input className="input" defaultValue={test.title} disabled={isLocked} id="test-title" name="title" required />
              </div>
              <div className="row">
                <div className="field field-half">
                  <label htmlFor="passPercent">Проходной балл (%)</label>
                  <input className="input" defaultValue={test.passPercent} disabled={isLocked} id="passPercent" min={0} max={100} name="passPercent" required type="number" />
                </div>
                <div className="field field-half">
                  <label htmlFor="maxAttempts">Макс. попыток</label>
                  <input className="input" defaultValue={test.maxAttempts} disabled={isLocked} id="maxAttempts" min={1} max={10} name="maxAttempts" required type="number" />
                </div>
              </div>
              <button className="btn btn-primary" disabled={isLocked} title={isLocked ? "Тест уже сдавали — параметры заблокированы" : undefined} type="submit">
                Сохранить параметры
              </button>
            </form>
            <form action={deleteTestAction}>
              <input name="testId" type="hidden" value={test.id} />
              <p className="card-helper">Удаление сотрет все попытки и ответы менеджеров.</p>
              <button className="btn btn-ghost btn-danger" type="submit">
                Удалить тест
              </button>
            </form>
          </section>

          <section className="card stack">
            <div>
              <h3>Добавить вопрос</h3>
              <p className="text-muted">Выберите тип вопроса и задайте правильный ответ</p>
            </div>
            {isLocked ? (
              <p className="text-muted">Добавление вопросов недоступно: тест уже сдавали.</p>
            ) : (
              <QuestionForm action={createQuestionAction} initialType="SINGLE_CHOICE" mode="create" testId={test.id} />
            )}
          </section>
        </div>

        <section className="card stack">
          <div>
            <h3>Вопросы теста</h3>
            <p className="text-muted">Порядок вопросов и краткий preview правильных ответов</p>
          </div>

          {test.questions.length === 0 ? (
            <p className="text-muted">Добавьте первый вопрос слева.</p>
          ) : (
            <div className="stack">
              {test.questions.map((question, index) => (
                <article className="question-row" key={question.id}>
                  <div className="question-row-order">{question.order}</div>
                  <div className="question-row-body">
                    <strong>{question.prompt}</strong>
                    <div className="text-muted small">
                      {typeLabels[question.type]} · {balls(question.points)}
                    </div>
                    <AnswerPreview question={question as QuestionForPreview} />
                  </div>
                  <div className="question-row-actions">
                    <form action={reorderQuestionAction}>
                      <input name="questionId" type="hidden" value={question.id} />
                      <input name="direction" type="hidden" value="up" />
                      <button className="btn btn-icon btn-ghost" disabled={isLocked || index === 0} title={isLocked ? "Структура теста заблокирована" : "Вверх"} type="submit">
                        <ChevronUp size={17} />
                      </button>
                    </form>
                    <form action={reorderQuestionAction}>
                      <input name="questionId" type="hidden" value={question.id} />
                      <input name="direction" type="hidden" value="down" />
                      <button className="btn btn-icon btn-ghost" disabled={isLocked || index === test.questions.length - 1} title={isLocked ? "Структура теста заблокирована" : "Вниз"} type="submit">
                        <ChevronDown size={17} />
                      </button>
                    </form>
                    {isLocked ? (
                      <button className="btn btn-icon btn-ghost" disabled title="Структура теста заблокирована" type="button">
                        <Edit2 size={17} />
                      </button>
                    ) : (
                      <Link className="btn btn-icon btn-ghost" href={`/admin/courses/${course.id}/test/questions/${question.id}`} title="Редактировать">
                        <Edit2 size={17} />
                      </Link>
                    )}
                    <form action={deleteQuestionAction}>
                      <input name="questionId" type="hidden" value={question.id} />
                      <button className="btn btn-icon btn-ghost btn-danger" disabled={isLocked} title={isLocked ? "Структура теста заблокирована" : "Удалить"} type="submit">
                        <Trash2 size={17} />
                      </button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
