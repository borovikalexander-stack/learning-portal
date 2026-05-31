import { notFound, redirect } from "next/navigation";
import { AttemptResultView } from "@/components/portal/AttemptResultView";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireSession } from "@/lib/auth/session";
import { getAttemptResult } from "@/lib/portal/testing";

type Props = {
  params: Promise<{ slug: string; attemptId: string }>;
};

export default async function FinalTestResultPage({ params }: Props) {
  const session = await requireSession();
  const { slug, attemptId } = await params;

  const result = await getAttemptResult(session.userId, attemptId);
  if (!result) notFound();
  if (result.attempt.courseSlug !== slug || result.attempt.lessonId) {
    redirect(`/courses/${slug}`);
  }

  const attemptsLeft = result.test.maxAttempts - result.totalAttempts;
  return (
    <div className="stack">
      <PageHeader
        breadcrumbs={[
          { label: "Мои курсы", href: "/" },
          { label: result.test.courseTitle, href: `/courses/${slug}` },
          { label: "Итоговый тест", href: `/courses/${slug}/test` },
          { label: "Результат" }
        ]}
        eyebrow="Результат итогового теста"
        title={result.test.title}
      >
        <p className="text-muted">{result.test.courseTitle}</p>
      </PageHeader>

      <AttemptResultView
        backHref={`/courses/${slug}`}
        result={result}
        retryHref={attemptsLeft > 0 ? `/courses/${slug}/test` : null}
      />
    </div>
  );
}
