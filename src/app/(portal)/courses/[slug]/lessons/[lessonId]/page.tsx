import { Check, Paperclip, Video } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageReveal } from "@/components/motion/PageReveal";
import { StaggerReveal } from "@/components/motion/StaggerReveal";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireSession } from "@/lib/auth/session";
import { markLessonCompleteAction } from "@/lib/portal/actions";
import { getCourseDetail, getLessonDetail } from "@/lib/portal/learning";

type LessonPageProps = {
  params: Promise<{ slug: string; lessonId: string }>;
};

export default async function LessonPage({ params }: LessonPageProps) {
  const session = await requireSession();
  const { slug, lessonId } = await params;

  try {
    const [detail, course] = await Promise.all([
      getLessonDetail(session.userId, slug, lessonId),
      getCourseDetail(session.userId, slug)
    ]);
    const embedBaseUrl = process.env.KINESCOPE_EMBED_BASE_URL;
    const iframeSrc = detail.kinescopeId && embedBaseUrl ? `${embedBaseUrl}/${detail.kinescopeId}` : null;
    const hasMaterials = Boolean(detail.markdown || detail.attachments.length);

    return (
      <PageReveal className="stack">
        <div className="stack" style={{ gap: 24 }}>
          <div data-reveal>
            <PageHeader
              actions={
                <Link className="btn btn-secondary" href={`/courses/${detail.courseSlug}` as Route}>
                  ← К списку уроков
                </Link>
              }
              eyebrow={detail.courseTitle}
              title={detail.title}
            />
          </div>

        <div className="lesson-grid">
          <section className="card lesson-video-card motion-card" data-reveal>
            {iframeSrc ? (
              <iframe
                allow="autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer"
                allowFullScreen
                frameBorder={0}
                src={iframeSrc}
                style={{ width: "100%", border: 0 }}
                title={detail.title}
              />
            ) : (
              <div className="lesson-video-fallback">
                <Video size={36} />
                <p>Видео не загружено</p>
              </div>
            )}
            {hasMaterials ? (
              <div className="lesson-materials">
                {detail.markdown ? (
                  <p className="text-muted" style={{ whiteSpace: "pre-wrap" }}>
                    {detail.markdown}
                  </p>
                ) : null}
                {detail.attachments.length ? (
                  <div className="stack">
                    <h3>Материалы</h3>
                    {detail.attachments.map((attachment) => (
                      <a className="row text-muted" href={attachment.url} key={attachment.id} rel="noreferrer" target="_blank">
                        <Paperclip size={16} />
                        <span>{attachment.title}</span>
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          <aside className="stack" data-reveal>
            <section className="card card-compact stack motion-card">
              <div>
                <p className="eyebrow">Прогресс</p>
                <h3>
                  Урок {detail.order} из {detail.totalLessons}
                </h3>
              </div>
              <StaggerReveal className="stack" >
                {course.lessons.map((lesson) => {
                  const isActive = lesson.id === detail.id;
                  const canOpen = !lesson.isLocked;

                  const content = (
                    <>
                      <span
                        className="lesson-dot"
                        style={{ background: lesson.isCompleted ? "var(--accent)" : lesson.isLocked ? "var(--border-strong)" : "var(--text)" }}
                      />
                      <span style={{ fontWeight: isActive ? 700 : 500 }}>{lesson.title}</span>
                    </>
                  );

                  return canOpen ? (
                    <Link
                      className="row text-muted"
                      data-stagger-item
                      href={`/courses/${detail.courseSlug}/lessons/${lesson.id}` as Route}
                      key={lesson.id}
                      style={{ fontSize: 13 }}
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className="row text-muted" data-stagger-item key={lesson.id} style={{ fontSize: 13 }}>
                      {content}
                    </div>
                  );
                })}
              </StaggerReveal>
            </section>

            <section className="card card-compact stack motion-card" data-reveal>
              {detail.test ? (
                detail.test.passed ? (
                  <div className="stack" style={{ gap: 8 }}>
                    <div className="badge badge-accent" style={{ width: "100%", justifyContent: "center", padding: 12 }}>
                      <Check size={16} /> Тест пройден
                    </div>
                    <Link
                      className="btn btn-ghost btn-sm"
                      href={`/courses/${detail.courseSlug}/lessons/${detail.id}/test` as Route}
                      style={{ justifyContent: "center" }}
                    >
                      Посмотреть результат
                    </Link>
                  </div>
                ) : (
                  <div className="stack" style={{ gap: 8 }}>
                    <p className="text-muted small">Урок завершается прохождением теста</p>
                    <Link
                      className="btn btn-accent btn-block"
                      href={`/courses/${detail.courseSlug}/lessons/${detail.id}/test` as Route}
                    >
                      Пройти тест
                    </Link>
                  </div>
                )
              ) : detail.isCompleted ? (
                <div className="badge badge-accent" style={{ width: "100%", justifyContent: "center", padding: 12 }}>
                  <Check size={16} /> Урок пройден
                </div>
              ) : (
                <form action={markLessonCompleteAction}>
                  <input name="lessonId" type="hidden" value={detail.id} />
                  <input name="courseSlug" type="hidden" value={detail.courseSlug} />
                  <button className="btn btn-accent btn-block" type="submit">
                    Отметить пройденным
                  </button>
                </form>
              )}

              <div className="row" style={{ flexWrap: "wrap" }}>
                {detail.prevLessonId ? (
                  <Link className="btn btn-secondary" href={`/courses/${detail.courseSlug}/lessons/${detail.prevLessonId}` as Route}>
                    ← Предыдущий
                  </Link>
                ) : null}
                {detail.nextLessonId && detail.isCompleted ? (
                  <Link className="btn btn-primary" href={`/courses/${detail.courseSlug}/lessons/${detail.nextLessonId}` as Route}>
                    Следующий →
                  </Link>
                ) : !detail.nextLessonId && detail.isCompleted ? (
                  <Link className="btn btn-primary" href={`/courses/${detail.courseSlug}` as Route}>
                    Завершить курс →
                  </Link>
                ) : null}
              </div>
            </section>
          </aside>
        </div>
        </div>
      </PageReveal>
    );
  } catch (error) {
    if (error instanceof Error && error.message === "NO_ACCESS") {
      redirect("/");
    }

    if (error instanceof Error && error.message === "LOCKED") {
      redirect(`/courses/${slug}`);
    }

    throw error;
  }
}
