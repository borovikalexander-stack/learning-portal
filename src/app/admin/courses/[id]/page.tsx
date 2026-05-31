import { Archive, ChevronDown, ChevronUp, Edit2, EyeOff, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  archiveCourseAction,
  deleteCourseAction,
  publishCourseAction,
  unpublishCourseAction,
  updateCourseAction
} from "@/lib/admin/courses";
import { createLessonAction, deleteLessonAction, reorderLessonAction } from "@/lib/admin/lessons";
import { createTestAction } from "@/lib/admin/tests";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

type CourseEditorPageProps = {
  params: Promise<{ id: string }>;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

export default async function CourseEditorPage({ params }: CourseEditorPageProps) {
  await requireAdmin();
  const { id } = await params;

  const [course, departments] = await Promise.all([
    prisma.course.findUnique({
      where: { id },
      include: {
        department: true,
        lessons: {
          orderBy: { order: "asc" },
          include: {
            test: {
              select: { id: true }
            },
            _count: {
              select: { attachments: true }
            }
          }
        },
        tests: {
          where: { lessonId: null },
          orderBy: { createdAt: "asc" },
          include: {
            _count: {
              select: { questions: true }
            }
          }
        }
      }
    }),
    prisma.department.findMany({
      orderBy: { name: "asc" }
    })
  ]);

  if (!course) {
    notFound();
  }

  const primaryTest = course.tests[0];
  const extraTestsCount = Math.max(0, course.tests.length - 1);

  return (
    <div className="stack">
      <PageHeader
        actions={
          <div className="row">
            {course.status === "DRAFT" ? (
              <form action={publishCourseAction}>
                <input name="id" type="hidden" value={course.id} />
                <button className="btn btn-accent" type="submit">
                  <Send size={17} />
                  Опубликовать
                </button>
              </form>
            ) : null}
            {course.status === "PUBLISHED" ? (
              <form action={unpublishCourseAction}>
                <input name="id" type="hidden" value={course.id} />
                <button className="btn btn-secondary" type="submit">
                  <EyeOff size={17} />
                  Снять с публикации
                </button>
              </form>
            ) : null}
            <form action={archiveCourseAction}>
              <input name="id" type="hidden" value={course.id} />
              <button className="btn btn-ghost" type="submit">
                <Archive size={17} />
                Архив
              </button>
            </form>
            {course.status === "DRAFT" ? (
              <form action={deleteCourseAction}>
                <input name="id" type="hidden" value={course.id} />
                <button className="btn btn-ghost btn-danger" type="submit">
                  <Trash2 size={17} />
                  Удалить
                </button>
              </form>
            ) : null}
          </div>
        }
        breadcrumbs={[
          { label: "Курсы", href: "/admin/courses" },
          { label: course.title }
        ]}
        eyebrow="Курс"
        title={course.title}
      >
        <div className="row">
          <StatusBadge status={course.status} />
          <p className="text-muted">
            Slug: /{course.slug} · Отдел: {course.department.name} · Обновлён {formatDate(course.updatedAt)}
          </p>
        </div>
      </PageHeader>

      <div className="editor-grid">
        <form action={updateCourseAction} className="stack">
          <input name="id" type="hidden" value={course.id} />
          <section className="card stack">
            <div>
              <h3>Основное</h3>
              <p className="text-muted">Базовая информация, которая видна менеджерам</p>
            </div>
            <div className="field">
              <label htmlFor="slug">Идентификатор (slug)</label>
              <input className="input" defaultValue={course.slug} id="slug" name="slug" required />
              <p className="card-helper">Латиница, цифры, тире. Используется в URL: /courses/&lt;slug&gt;.</p>
            </div>
            <div className="field">
              <label htmlFor="title">Название</label>
              <input className="input" defaultValue={course.title} id="title" name="title" required />
            </div>
            <div className="field">
              <label htmlFor="description">Описание</label>
              <textarea className="textarea" defaultValue={course.description} id="description" name="description" required rows={4} />
            </div>
          </section>

          <section className="card stack">
            <div>
              <h3>Внешний вид</h3>
              <p className="text-muted">Оценка длительности и акцент курса</p>
            </div>
            <div className="field">
              <label htmlFor="estimatedMins">Длительность (мин)</label>
              <input
                className="input"
                defaultValue={course.estimatedMins}
                id="estimatedMins"
                min={1}
                max={1000}
                name="estimatedMins"
                required
                type="number"
              />
            </div>
            <div className="field">
              <label htmlFor="accent">Цвет акцента</label>
              <label className="color-picker" htmlFor="accent">
                <input
                  className="color-picker-input"
                  defaultValue={course.accent}
                  id="accent"
                  name="accent"
                  required
                  type="color"
                />
                <span className="color-picker-swatch" aria-hidden style={{ background: course.accent }} />
                <span className="color-picker-value">{course.accent.toUpperCase()}</span>
              </label>
              <p className="card-helper">Используется в карточке курса у менеджера</p>
            </div>
          </section>

          <section className="card stack">
            <div>
              <h3>Доступ</h3>
              <p className="text-muted">Отдел и правило назначения для новых менеджеров</p>
            </div>
            <div className="field">
              <label htmlFor="departmentId">Отдел</label>
              <select className="select" defaultValue={course.departmentId} id="departmentId" name="departmentId" required>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
            <label className="field-checkbox">
              <input defaultChecked={course.isDefault} name="isDefault" type="checkbox" />
              <span>Назначать всем новым менеджерам отдела автоматически</span>
            </label>
            <p className="card-helper">Существующим менеджерам потребуется ручное назначение.</p>
          </section>

          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn btn-primary" type="submit">
              Сохранить изменения
            </button>
          </div>
        </form>

        <div className="stack">
        <section className="card stack course-editor-lessons">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <h3>Уроки ({course.lessons.length})</h3>
              <p className="text-muted">Порядок, видео и материалы курса</p>
            </div>
            <span className="badge badge-dark">{course.estimatedMins} мин</span>
          </div>

          {course.lessons.length === 0 ? (
            <p className="text-muted">Уроков пока нет. Добавьте первый ниже.</p>
          ) : (
            <div className="stack">
              {course.lessons.map((lesson, index) => (
                <article className="lesson-row" key={lesson.id}>
                  <div className="lesson-row-order">{lesson.order}</div>
                  <div className="lesson-row-body">
                    <strong>{lesson.title}</strong>
                    <div className="text-muted small">
                      {lesson.durationMins} мин · {lesson._count.attachments} вложений{lesson.kinescopeId ? " · видео" : ""}
                      {lesson.test ? " · тест" : ""}
                    </div>
                  </div>
                  <div className="lesson-row-actions">
                    <form action={reorderLessonAction}>
                      <input name="lessonId" type="hidden" value={lesson.id} />
                      <input name="direction" type="hidden" value="up" />
                      <button className="btn btn-icon btn-ghost" disabled={index === 0} title="Вверх" type="submit">
                        <ChevronUp size={17} />
                      </button>
                    </form>
                    <form action={reorderLessonAction}>
                      <input name="lessonId" type="hidden" value={lesson.id} />
                      <input name="direction" type="hidden" value="down" />
                      <button className="btn btn-icon btn-ghost" disabled={index === course.lessons.length - 1} title="Вниз" type="submit">
                        <ChevronDown size={17} />
                      </button>
                    </form>
                    <Link className="btn btn-icon btn-ghost" href={`/admin/courses/${course.id}/lessons/${lesson.id}`} title="Редактировать">
                      <Edit2 size={17} />
                    </Link>
                    <form action={deleteLessonAction}>
                      <input name="lessonId" type="hidden" value={lesson.id} />
                      <button className="btn btn-icon btn-ghost btn-danger" title="Удалить" type="submit">
                        <Trash2 size={17} />
                      </button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="editor-separator" />

          <form action={createLessonAction} className="admin-form">
            <input name="courseId" type="hidden" value={course.id} />
            <h4>Добавить урок</h4>
            <div className="field">
              <label htmlFor="lesson-title">Название</label>
              <input className="input" id="lesson-title" name="title" required />
            </div>
            <div className="row">
              <div className="field field-half">
                <label htmlFor="durationMins">Длительность (мин)</label>
                <input className="input" defaultValue={10} id="durationMins" min={1} max={600} name="durationMins" required type="number" />
              </div>
              <div className="field field-half">
                <label htmlFor="kinescopeId">Kinescope ID</label>
                <input className="input" id="kinescopeId" name="kinescopeId" placeholder="abc-test-123" />
              </div>
            </div>
            <div className="field">
              <label htmlFor="markdown">Описание урока</label>
              <textarea className="textarea" id="markdown" name="markdown" rows={3} />
            </div>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn btn-accent" type="submit">
                Добавить урок
              </button>
            </div>
          </form>
        </section>
        <section className="card stack">
          <div>
            <h3>Тест</h3>
            <p className="text-muted">Проверка знаний по курсу. В MVP используем один тест на курс.</p>
          </div>

          {extraTestsCount > 0 ? (
            <span className="badge badge-warning">В БД найдено ещё {extraTestsCount} тестов. Показываем первый.</span>
          ) : null}

          {primaryTest ? (
            <div className="stack">
              <p className="text-muted">
                {primaryTest._count.questions} вопросов · {primaryTest.passPercent}% проходной · {primaryTest.maxAttempts} попытки
              </p>
              <Link className="btn btn-primary" href={`/admin/courses/${course.id}/test`}>
                Открыть редактор теста →
              </Link>
            </div>
          ) : (
            <div className="stack">
              <p className="text-muted">У курса ещё нет теста. Создайте, чтобы менеджеры могли проверить знания.</p>
              <form action={createTestAction} className="stack">
                <input name="courseId" type="hidden" value={course.id} />
                <input name="title" type="hidden" value="Итоговый тест" />
                <input name="passPercent" type="hidden" value={70} />
                <input name="maxAttempts" type="hidden" value={2} />
                <button className="btn btn-accent" type="submit">
                  Создать тест
                </button>
              </form>
            </div>
          )}
        </section>
        </div>
      </div>
    </div>
  );
}
