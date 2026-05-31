import { Archive, BookOpen, Edit2, EyeOff, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { PageReveal } from "@/components/motion/PageReveal";
import { StaggerReveal } from "@/components/motion/StaggerReveal";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  archiveCourseAction,
  deleteCourseAction,
  publishCourseAction,
  unpublishCourseAction
} from "@/lib/admin/courses";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

type CourseStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

const statusSections: { status: CourseStatus; title: string }[] = [
  { status: "DRAFT", title: "Черновики" },
  { status: "PUBLISHED", title: "Опубликованные" },
  { status: "ARCHIVED", title: "Архив" }
];

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

export default async function AdminCoursesPage() {
  await requireAdmin();

  const courses = await prisma.course.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      department: true,
      _count: {
        select: {
          lessons: true,
          courseAccesses: true
        }
      }
    }
  });

  const counts = {
    total: courses.length,
    published: courses.filter((course) => course.status === "PUBLISHED").length,
    draft: courses.filter((course) => course.status === "DRAFT").length,
    archived: courses.filter((course) => course.status === "ARCHIVED").length
  };

  return (
    <PageReveal className="stack">
      <div data-reveal>
      <PageHeader
        actions={
          <Link className="btn btn-accent" href="/admin/courses/new">
            + Новый курс
          </Link>
        }
        eyebrow="Контент"
        title="Курсы"
      >
        <p className="text-muted">
          {counts.total} курсов: {counts.published} опубликовано, {counts.draft} в черновиках, {counts.archived} в архиве
        </p>
      </PageHeader>
      </div>

      {courses.length === 0 ? (
        <section className="card empty-state motion-card" data-reveal>
          <BookOpen size={42} />
          <h2>Курсов пока нет. Создайте первый.</h2>
          <Link className="btn btn-accent btn-lg" href="/admin/courses/new">
            + Новый курс
          </Link>
        </section>
      ) : (
        statusSections.map(({ status, title }) => {
          const groupedCourses = courses.filter((course) => course.status === status);

          if (groupedCourses.length === 0) {
            return null;
          }

          return (
            <section key={status} data-reveal>
              <h2 className="section-title">
                {title} ({groupedCourses.length})
              </h2>
              <StaggerReveal className="card" itemSelector="tbody tr">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Курс</th>
                      <th>Отдел</th>
                      <th>Уроков</th>
                      <th>Назначений</th>
                      <th>Обновлён</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedCourses.map((course) => (
                      <tr key={course.id}>
                        <td>
                          <div className="row">
                            <span className="accent-dot" style={{ background: course.accent }} />
                            <div>
                              <strong>{course.title}</strong>
                              <div className="text-muted">{course.slug}</div>
                            </div>
                          </div>
                        </td>
                        <td>{course.department.name}</td>
                        <td>{course._count.lessons}</td>
                        <td>{course._count.courseAccesses}</td>
                        <td>{formatDate(course.updatedAt)}</td>
                        <td>
                          <div className="table-actions">
                            <Link className="btn btn-icon btn-ghost" href={`/admin/courses/${course.id}`} title="Редактировать">
                              <Edit2 size={17} />
                            </Link>
                            {course.status === "DRAFT" ? (
                              <form action={publishCourseAction}>
                                <input name="id" type="hidden" value={course.id} />
                                <button className="btn btn-icon btn-ghost" title="Опубликовать" type="submit">
                                  <Send size={17} />
                                </button>
                              </form>
                            ) : null}
                            {course.status === "PUBLISHED" ? (
                              <form action={unpublishCourseAction}>
                                <input name="id" type="hidden" value={course.id} />
                                <button className="btn btn-icon btn-ghost" title="Снять с публикации" type="submit">
                                  <EyeOff size={17} />
                                </button>
                              </form>
                            ) : null}
                            {course.status !== "ARCHIVED" ? (
                              <form action={archiveCourseAction}>
                                <input name="id" type="hidden" value={course.id} />
                                <button className="btn btn-icon btn-ghost" title="Архивировать" type="submit">
                                  <Archive size={17} />
                                </button>
                              </form>
                            ) : null}
                            {course.status === "DRAFT" ? (
                              <form action={deleteCourseAction}>
                                <input name="id" type="hidden" value={course.id} />
                                <button className="btn btn-icon btn-ghost btn-danger" title="Удалить" type="submit">
                                  <Trash2 size={17} />
                                </button>
                              </form>
                            ) : (
                              <button className="btn btn-icon btn-ghost" disabled title="Сначала снимите с публикации" type="button">
                                <Trash2 size={17} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </StaggerReveal>
            </section>
          );
        })
      )}
    </PageReveal>
  );
}
