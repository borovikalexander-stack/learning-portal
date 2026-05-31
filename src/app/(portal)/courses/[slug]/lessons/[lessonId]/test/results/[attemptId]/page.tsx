import { notFound, redirect } from "next/navigation";
import { AttemptResultView } from "@/components/portal/AttemptResultView";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireSession } from "@/lib/auth/session";
import { getAttemptResult } from "@/lib/portal/testing";

type Props = {
  params: Promise<{ slug: string; lessonId: string; attemptId: string }>;
};

export default async function LessonTestResultPage({ params }: Props) {
  const session = await requireSession();
  const { slug, lessonId, attemptId } = await params;

  const result = await getAttemptResult(session.userId, attemptId);
  if (!result) notFound();
  if (result.attempt.courseSlug !== slug || result.attempt.lessonId !== lessonId) {
    redirect(`/courses/${slug}/lessons/${lessonId}`);
  }

  const attemptsLeft = result.test.maxAttempts - result.totalAttempts;
  return (
    <div className="stack">
      <PageHeader
        breadcrumbs={[
          { label: "Мои курсы", href: "/" },
          { label: result.test.courseTitle, href: `/courses/${slug}` },
          { label: result.test.lessonTitle ?? "Урок", href: `/courses/${slug}/lessons/${lessonId}` },
          { label: "Тест" }
        ]}
        eyebrow={`Урок: ${result.test.lessonTitle ?? ""}`}
        title={result.test.title}
      >
        <p className="text-muted">{result.test.courseTitle}</p>
      </PageHeader>

      <AttemptResultView
        backHref={`/courses/${slug}/lessons/${lessonId}`}
        result={result}
        retryHref={attemptsLeft > 0 ? `/courses/${slug}/lessons/${lessonId}/test` : null}
      />
    </div>
  );
}
