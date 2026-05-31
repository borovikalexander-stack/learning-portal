import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageReveal } from "@/components/motion/PageReveal";
import { TestRunner } from "@/components/portal/TestRunner";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getLessonDetail } from "@/lib/portal/learning";
import { getTestForTaking } from "@/lib/portal/testing";

type LessonTestPageProps = {
  params: Promise<{ slug: string; lessonId: string }>;
};

export default async function LessonTestPage({ params }: LessonTestPageProps) {
  const session = await requireSession();
  const { slug, lessonId } = await params;

  // Validate access via getLessonDetail (handles LOCKED/NO_ACCESS)
  try {
    await getLessonDetail(session.userId, slug, lessonId);
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "LOCKED") redirect(`/courses/${slug}`);
    if (msg === "NO_ACCESS") redirect("/");
    throw e;
  }

  const test = await prisma.test.findUnique({
    where: { lessonId },
    select: { id: true }
  });
  if (!test) notFound();

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
          <Link className="btn btn-secondary" href={`/courses/${slug}/lessons/${lessonId}`}>
            ← К уроку
          </Link>
        }
        breadcrumbs={[
          { label: "Мои курсы", href: "/" },
          { label: taking.courseTitle, href: `/courses/${slug}` },
          { label: taking.lessonTitle ?? "Урок", href: `/courses/${slug}/lessons/${lessonId}` },
          { label: "Тест" }
        ]}
        eyebrow={`Урок ${taking.lessonOrder ?? ""} · ${taking.courseTitle}`}
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
          <span className="badge badge-accent">Тест пройден</span>
          <h3>Вы успешно сдали тест к уроку</h3>
          <p className="text-muted">Урок отмечен как пройденный. Можно перейти к следующему.</p>
          <Link className="btn btn-primary" href={`/courses/${slug}/lessons/${lessonId}`}>
            Вернуться к уроку
          </Link>
        </section>
      ) : attemptsLeft <= 0 ? (
        <section className="card stack motion-card" data-reveal>
          <span className="badge badge-danger">Попытки закончились</span>
          <h3>Все попытки использованы</h3>
          <p className="text-muted">Обратитесь к РОПу или администратору, чтобы открыть дополнительные попытки.</p>
          <Link className="btn btn-secondary" href={`/courses/${slug}/lessons/${lessonId}`}>
            Вернуться к уроку
          </Link>
        </section>
      ) : (
        <TestRunner
          courseSlug={slug}
          lessonId={lessonId}
          questions={taking.questions}
          testId={taking.id}
        />
      )}
      </div>
    </PageReveal>
  );
}
