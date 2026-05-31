import { Clock3 } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { AnimatedBar } from "@/components/motion/AnimatedBar";
import type { DashboardCourse } from "@/lib/portal/dashboard";

type CourseCardProps = {
  course: DashboardCourse;
};

export function CourseCard({ course }: CourseCardProps) {
  const accessLabel = course.accessSource === "DEPARTMENT_DEFAULT" ? "Курс отдела" : "Назначен вручную";
  const accessClass = course.accessSource === "DEPARTMENT_DEFAULT" ? "badge badge-accent" : "badge";

  return (
    <article className="card course-card-new motion-card" data-stagger-item>
      <div className="stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className={accessClass}>{accessLabel}</span>
          <span className="accent-dot" style={{ background: course.accent }} />
        </div>
        <div className="stack" style={{ gap: 8 }}>
          <p className="eyebrow">{course.departmentName}</p>
          <h3>{course.title}</h3>
          <p className="text-muted">{course.description}</p>
        </div>
        <div className="row text-muted" style={{ fontSize: 13 }}>
          <Clock3 size={16} />
          <span>{course.estimatedMins} мин</span>
          <span>·</span>
          <span>{course.lessonsCount} уроков</span>
        </div>
      </div>

      <footer className="stack" style={{ gap: 12 }}>
        <div>
          <AnimatedBar color={course.accent} label={`Прогресс курса ${course.progressPercent}%`} value={course.progressPercent} />
          <p className="text-muted" style={{ marginTop: 8, fontSize: 13 }}>
            {course.progressPercent}% пройдено
          </p>
        </div>
        <Link className="btn btn-primary" href={`/courses/${course.slug}` as Route} style={{ width: "100%" }}>
          Открыть курс
        </Link>
      </footer>
    </article>
  );
}
