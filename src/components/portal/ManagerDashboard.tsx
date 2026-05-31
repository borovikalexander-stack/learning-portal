import type { Route } from "next";
import Link from "next/link";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import { PageReveal } from "@/components/motion/PageReveal";
import { StaggerReveal } from "@/components/motion/StaggerReveal";
import { PageHeader } from "@/components/ui/PageHeader";
import type { DashboardSnapshot } from "@/lib/portal/dashboard";
import { CourseCard } from "./CourseCard";

type ManagerDashboardProps = {
  snapshot: DashboardSnapshot;
};

type NextStep = NonNullable<DashboardSnapshot["nextStep"]>;

function nextStepTitle(step: NextStep) {
  switch (step.type) {
    case "lesson":
      return `Урок «${step.targetTitle}»`;
    case "lessonTest":
      return `Тест к уроку «${step.targetTitle}»`;
    case "finalTest":
      return "Итоговый тест курса";
  }
}

function nextStepCta(type: NextStep["type"]) {
  switch (type) {
    case "lesson":
      return "Продолжить →";
    case "lessonTest":
      return "Пройти тест →";
    case "finalTest":
      return "Сдать итоговый →";
  }
}

function getAccessNote(snapshot: DashboardSnapshot) {
  const departmentDefaultCount = snapshot.courses.filter((course) => course.accessSource === "DEPARTMENT_DEFAULT").length;
  const manualGrantCount = snapshot.courses.filter((course) => course.accessSource === "MANUAL_GRANT").length;

  if (!departmentDefaultCount && !manualGrantCount) {
    return "Доступы не назначены";
  }

  return `${departmentDefaultCount} курса отдела + ${manualGrantCount} вручную`;
}

export function ManagerDashboard({ snapshot }: ManagerDashboardProps) {
  const firstCourse = snapshot.courses[0];

  return (
    <PageReveal className="stack" >
      <div className="stack" style={{ gap: 24 }}>
        <div data-reveal>
          <PageHeader
            actions={
              firstCourse ? (
                <Link className="btn btn-accent" href={`/courses/${firstCourse.slug}` as Route}>
                  Продолжить обучение
                </Link>
              ) : null
            }
            eyebrow="Личный кабинет"
            title={`Здравствуйте, ${snapshot.user.firstName}`}
          >
            <p className="text-muted">
              Курсов: {snapshot.stats.assigned} · Завершено: {snapshot.stats.completed} · Отдел:{" "}
              {snapshot.user.departmentName ?? "не назначен"}
            </p>
          </PageHeader>
        </div>

      {snapshot.nextStep ? (
        <article className="card card-accent next-step motion-card" data-reveal>
          <div
            className="row"
            style={{ gap: 16, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}
          >
            <div className="stack" style={{ gap: 8 }}>
              <span className="eyebrow">Следующий шаг</span>
              <h2>{nextStepTitle(snapshot.nextStep)}</h2>
              <p>{snapshot.nextStep.courseTitle}</p>
            </div>
            <Link className="btn btn-primary btn-lg" href={snapshot.nextStep.href as Route}>
              {nextStepCta(snapshot.nextStep.type)}
            </Link>
          </div>
        </article>
      ) : snapshot.courses.length ? (
        <article className="card next-step-done motion-card" data-reveal>
          <h2>Все курсы пройдены 🎉</h2>
          <p className="text-muted">Поздравляем! Когда появятся новые курсы, мы покажем их здесь.</p>
        </article>
      ) : null}

      <StaggerReveal className="grid grid-4" >
        <article className="kpi accent motion-card" data-stagger-item>
          <span className="kpi-label">Назначено курсов</span>
          <AnimatedNumber className="kpi-value" value={snapshot.stats.assigned} />
          <span className="kpi-hint">{getAccessNote(snapshot)}</span>
        </article>
        <article className="kpi motion-card" data-stagger-item>
          <span className="kpi-label">Завершено</span>
          <AnimatedNumber className="kpi-value" value={snapshot.stats.completed} />
          <span className="kpi-hint">Курсы со 100% прогрессом</span>
        </article>
        <article className="kpi blue motion-card" data-stagger-item>
          <span className="kpi-label">Средний балл</span>
          <AnimatedNumber className="kpi-value" suffix="%" value={snapshot.stats.averageScorePercent} />
          <span className="kpi-hint">По завершённым попыткам</span>
        </article>
        <article className="kpi yellow motion-card" data-stagger-item>
          <span className="kpi-label">Проверка</span>
          <AnimatedNumber className="kpi-value" value={snapshot.stats.pendingReviews} />
          <span className="kpi-hint">Открытые ответы на проверке</span>
        </article>
      </StaggerReveal>

      <section className="stack" data-reveal>
        <div>
          <h2>Мои курсы</h2>
          <p className="text-muted">{snapshot.courses.length} курсов в обучении</p>
        </div>

        {snapshot.courses.length ? (
          <StaggerReveal className={`grid ${snapshot.courses.length <= 2 ? "grid-2" : "grid-3"}`}>
            {snapshot.courses.map((course) => (
              <CourseCard course={course} key={course.id} />
            ))}
          </StaggerReveal>
        ) : (
          <div className="card motion-card">
            <h3>Курсы пока не назначены</h3>
            <p className="text-muted" style={{ marginTop: 8 }}>
              После одобрения отдела или ручного назначения здесь появятся ваши курсы.
            </p>
          </div>
        )}
      </section>
      </div>
    </PageReveal>
  );
}
