import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageReveal } from "@/components/motion/PageReveal";
import { TestRunner } from "@/components/portal/TestRunner";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getCourseDetail } from "@/lib/portal/learning";
import { getTestForTaking } from "@/lib/portal/testing";

type FinalTestPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function FinalTestPage({ params }: FinalTestPageProps) {
  const session = await requireSession();
  const { slug } = await params;

  let courseDetail;
  try {
    courseDetail = await getCourseDetail(session.userId, slug);
  } catch {
    redirect("/");
  }

  // find course final test (lessonId: null)
  const test = await prisma.test.findFirst({
    where: { courseId: courseDetail.id, lessonId: null },
    select: { id: true }
  });
  if (!test) notFound();

  const allLessonsCompleted =
    courseDetail.lessons.length > 0 && courseDetail.lessons.every((l) => l.isCompleted);
  if (!allLessonsCompleted) {
    redirect(`/courses/${slug}`);
  }

  const taking = await getTestForTaking(session.userId, test.id);
  if (!taking) redirect(`/courses/${slug}`);

  const attemptsLeft = taking.maxAttempts - taking.attemptsUsed;
  const alreadyPassed = taking.bestAttempt?.passed === true;

  return (
    <PageReveal className="stack">
      <div className="stack">
      <div data-reveal>
        <PageHeader
        actions={
          <Link className="btn btn-secondary" href={`/courses/${slug}`}>
            ← К курсу
          </Link>
        }
        breadcrumbs={[
          { label: "Мои курсы", href: "/" },
          { label: taking.courseTitle, href: `/courses/${slug}` },
          { label: "Итоговый тест" }
        ]}
        eyebrow="Итоговый тест курса"
        title={taking.title}
      >
        <p className="text-muted">
          {taking.questions.length} вопросов · проходной {taking.passPercent}% · попыток осталось:{" "}
          <strong>{Math.max(0, attemptsLeft)}</strong> из {taking.maxAttempts}
        </p>
        </PageHeader>
      </div>

      {alreadyPassed ? (
        <section className="card stack motion-card" data-reveal>
          <span className="badge badge-accent">Тест уже пройден</span>
          <h3>Вы успешно сдали итоговый тест</h3>
          <p className="text-muted">
            Лучший результат: {taking.bestAttempt?.scorePercent ?? 0}%. Можно вернуться к курсу.
          </p>
          <Link className="btn btn-primary" href={`/courses/${slug}`}>
            Вернуться к курсу
          </Link>
        </section>
      ) : attemptsLeft <= 0 ? (
        <section className="card stack motion-card" data-reveal>
          <span className="badge badge-danger">Попытки закончились</span>
          <h3>Все попытки использованы</h3>
          <p className="text-muted">Обратитесь к администратору, чтобы открыть дополнительные попытки.</p>
          <Link className="btn btn-secondary" href={`/courses/${slug}`}>
            Вернуться к курсу
          </Link>
        </section>
      ) : (
        <TestRunner
          courseSlug={slug}
          lessonId={null}
          questions={taking.questions}
          testId={taking.id}
        />
      )}
      </div>
    </PageReveal>
  );
}
