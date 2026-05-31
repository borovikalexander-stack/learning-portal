import { CheckCircle2, Clock3, GraduationCap, LockKeyhole, Play } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageReveal } from "@/components/motion/PageReveal";
import { StaggerReveal } from "@/components/motion/StaggerReveal";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getCourseDetail } from "@/lib/portal/learning";

type CoursePageProps = {
  params: Promise<{ slug: string }>;
};

function AccessBadge({ source }: { source: "DEPARTMENT_DEFAULT" | "MANUAL_GRANT" }) {
  return source === "DEPARTMENT_DEFAULT" ? (
    <span className="badge badge-accent">Курс отдела</span>
  ) : (
    <span className="badge">Назначен вручную</span>
  );
}

export default async function CoursePage({ params }: CoursePageProps) {
  const session = await requireSession();
  const { slug } = await params;

  try {
    const detail = await getCourseDetail(session.userId, slug);

    const allLessonsCompleted = detail.lessons.length > 0 && detail.lessons.every((l) => l.isCompleted);
    const finalTest = await prisma.test.findFirst({
      where: { courseId: detail.id, lessonId: null },
      select: { id: true, title: true, passPercent: true }
    });

    let finalAttemptPassed: { id: string; passed: boolean } | null = null;
    if (finalTest) {
      const attempt = await prisma.testAttempt.findFirst({
        where: { userId: session.userId, testId: finalTest.id, passed: true },
        select: { id: true, passed: true }
      });
      finalAttemptPassed = attempt;
    }

    return (
      <PageReveal className="stack">
        <div className="stack" style={{ gap: 24 }}>
          <div data-reveal>
            <PageHeader
              actions={
                <Link className="btn btn-secondary" href="/">
                  ← К списку курсов
                </Link>
              }
              eyebrow={detail.departmentName}
              title={detail.title}
            >
              <p className="text-muted">{detail.description}</p>
            </PageHeader>
          </div>

        <div className="row" data-reveal style={{ flexWrap: "wrap" }}>
          <span className="badge badge-accent">
            <Clock3 size={14} /> {detail.estimatedMins} мин
          </span>
          <span className="badge">{detail.lessons.length} уроков</span>
          {finalTest ? <span className="badge badge-blue">Итоговый тест</span> : null}
          <AccessBadge source={detail.accessSource} />
          <span className="badge badge-dark">Прогресс {detail.progressPercent}%</span>
        </div>

        {finalTest ? (
          <section className={`card stack motion-card ${allLessonsCompleted ? "card-blue" : ""}`} data-reveal>
            <div className="row" style={{ gap: 12, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
              <div className="row" style={{ gap: 12 }}>
                <GraduationCap size={28} />
                <div>
                  <h3>{finalTest.title}</h3>
                  <p className="text-muted small">Проходной балл {finalTest.passPercent}%. Открывается после прохождения всех уроков.</p>
                </div>
              </div>
              {finalAttemptPassed ? (
                <span className="badge badge-accent">Тест сдан</span>
              ) : allLessonsCompleted ? (
                <Link className="btn btn-accent" href={`/courses/${detail.slug}/test` as Route}>
                  Пройти итоговый тест
                </Link>
              ) : (
                <span className="badge">Сначала пройдите все уроки</span>
              )}
            </div>
          </section>
        ) : null}

        <section className="stack" data-reveal>
          <h2>Уроки</h2>
          <StaggerReveal className="stack">
            {detail.lessons.map((lesson) => (
              <article className={`card card-compact lesson-row ${lesson.isLocked ? "" : "motion-card"}`} data-stagger-item key={lesson.id}>
                <div
                  className="lesson-status-icon"
                  style={{
                    background: lesson.isCompleted ? "var(--accent-soft)" : "var(--bg)",
                    color: lesson.isCompleted ? "#006B52" : lesson.isLocked ? "var(--text-muted)" : "var(--text)"
                  }}
                >
                  {lesson.isCompleted ? <CheckCircle2 size={20} /> : lesson.isLocked ? <LockKeyhole size={20} /> : <Play size={20} />}
                </div>
                <div style={{ flex: 1 }}>
                  <strong>{lesson.title}</strong>
                  <p className="text-muted" style={{ fontSize: 13 }}>
                    Урок {lesson.order} · {lesson.durationMins} мин
                  </p>
                </div>
                {lesson.isLocked ? (
                  <span className="badge">Заблокирован</span>
                ) : (
                  <Link className="btn btn-ghost" href={`/courses/${detail.slug}/lessons/${lesson.id}` as Route}>
                    Открыть →
                  </Link>
                )}
              </article>
            ))}
          </StaggerReveal>
        </section>
        </div>
      </PageReveal>
    );
  } catch (error) {
    if (error instanceof Error && error.message === "NO_ACCESS") {
      redirect("/");
    }

    throw error;
  }
}
