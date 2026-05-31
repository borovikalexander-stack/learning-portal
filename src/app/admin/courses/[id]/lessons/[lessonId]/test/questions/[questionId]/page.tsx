import Link from "next/link";
import { notFound } from "next/navigation";
import { QuestionForm } from "@/components/admin/QuestionForm";
import type { QuestionFormValues } from "@/components/admin/QuestionForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { updateQuestionAction } from "@/lib/admin/tests";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

type LessonQuestionEditorPageProps = {
  params: Promise<{ id: string; lessonId: string; questionId: string }>;
};

export default async function LessonQuestionEditorPage({ params }: LessonQuestionEditorPageProps) {
  await requireAdmin();
  const { id, lessonId, questionId } = await params;

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: {
      test: {
        include: {
          _count: {
            select: { attempts: true }
          },
          course: {
            select: { id: true, title: true }
          },
          lesson: {
            select: { id: true, title: true }
          }
        }
      }
    }
  });

  if (!question || question.test.course.id !== id || question.test.lessonId !== lessonId || !question.test.lesson) {
    notFound();
  }

  const attemptsCount = question.test._count.attempts;
  const isLocked = attemptsCount > 0;

  const initialValues: QuestionFormValues = {
    questionId: question.id,
    type: question.type,
    prompt: question.prompt,
    points: question.points,
    options: question.options,
    answerKey: question.answerKey
  };

  return (
    <div className="stack">
      <PageHeader
        actions={
          <Link className="btn btn-secondary" href={`/admin/courses/${id}/lessons/${lessonId}/test`}>
            ← К тесту урока
          </Link>
        }
        breadcrumbs={[
          { label: "Курсы", href: "/admin/courses" },
          { label: question.test.course.title, href: `/admin/courses/${id}` },
          { label: question.test.lesson.title, href: `/admin/courses/${id}/lessons/${lessonId}` },
          { label: "Тест", href: `/admin/courses/${id}/lessons/${lessonId}/test` },
          { label: `Вопрос ${question.order}` }
        ]}
        eyebrow="Редактор вопроса"
        title={`Вопрос ${question.order}`}
      >
        <p className="text-muted">{question.test.course.title}</p>
      </PageHeader>

      {isLocked ? (
        <section className="card row" style={{ alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
          <span className="badge badge-warning">Тест уже сдавали ({attemptsCount} попыток). Структура заблокирована.</span>
          <p className="text-muted">Редактирование вопроса недоступно.</p>
        </section>
      ) : null}

      <section className="card stack">
        <div>
          <h3>Настройки вопроса</h3>
          <p className="text-muted">Тип, формулировка, баллы и правильные ответы</p>
        </div>
        <QuestionForm action={updateQuestionAction} disabled={isLocked} initialValues={initialValues} mode="edit" />
      </section>
    </div>
  );
}
