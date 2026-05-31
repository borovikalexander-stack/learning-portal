import { Paperclip, Trash2, Video } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { addAttachmentAction, deleteAttachmentAction, updateLessonAction } from "@/lib/admin/lessons";
import { createTestAction } from "@/lib/admin/tests";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

type LessonEditorPageProps = {
  params: Promise<{ id: string; lessonId: string }>;
};

export default async function LessonEditorPage({ params }: LessonEditorPageProps) {
  await requireAdmin();
  const { id, lessonId } = await params;

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      course: true,
      test: {
        include: {
          _count: {
            select: { questions: true }
          }
        }
      },
      attachments: {
        orderBy: { createdAt: "asc" }
      }
    }
  });

  if (!lesson || lesson.courseId !== id) {
    notFound();
  }

  const embedBaseUrl = process.env.KINESCOPE_EMBED_BASE_URL;

  return (
    <div className="stack">
      <PageHeader
        actions={
          <Link className="btn btn-secondary" href={`/admin/courses/${lesson.course.id}`}>
            ← К курсу
          </Link>
        }
        breadcrumbs={[
          { label: "Курсы", href: "/admin/courses" },
          { label: lesson.course.title, href: `/admin/courses/${lesson.course.id}` },
          { label: `Урок ${lesson.order}` }
        ]}
        eyebrow={`Урок ${lesson.order}`}
        title={lesson.title}
      >
        <p className="text-muted">
          Длительность: {lesson.durationMins} мин · {lesson.attachments.length} вложений
        </p>
      </PageHeader>

      <div className="editor-grid">
        <div className="stack">
          <section className="card stack">
            <div>
              <h3>Превью</h3>
              <p className="text-muted">Так видео будет выглядеть для менеджера</p>
            </div>
            {lesson.kinescopeId && embedBaseUrl ? (
              <div className="lesson-preview-frame">
                <iframe
                  allow="autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer"
                  allowFullScreen
                  frameBorder={0}
                  src={`${embedBaseUrl}/${lesson.kinescopeId}`}
                  title={lesson.title}
                />
              </div>
            ) : (
              <div className="lesson-preview-fallback">
                <Video size={38} />
                <strong>Kinescope ID не указан</strong>
                <p>Заполните поле справа чтобы появилось видео</p>
              </div>
            )}
          </section>

          <section className="card stack">
            <h3>Описание</h3>
            {lesson.markdown ? (
              <p style={{ whiteSpace: "pre-wrap" }}>{lesson.markdown}</p>
            ) : (
              <p className="text-muted">Описание не задано</p>
            )}
          </section>
        </div>

        <div className="stack">
          <form action={updateLessonAction} className="card admin-form">
            <input name="lessonId" type="hidden" value={lesson.id} />
            <h3>Свойства</h3>
            <div className="field">
              <label htmlFor="title">Название</label>
              <input className="input" defaultValue={lesson.title} id="title" name="title" required />
            </div>
            <div className="row">
              <div className="field field-half">
                <label htmlFor="durationMins">Длительность (мин)</label>
                <input
                  className="input"
                  defaultValue={lesson.durationMins}
                  id="durationMins"
                  min={1}
                  max={600}
                  name="durationMins"
                  required
                  type="number"
                />
              </div>
              <div className="field field-half">
                <label htmlFor="kinescopeId">Kinescope ID</label>
                <input className="input" defaultValue={lesson.kinescopeId ?? ""} id="kinescopeId" name="kinescopeId" />
              </div>
            </div>
            <div className="field">
              <label htmlFor="markdown">Описание урока</label>
              <textarea className="textarea" defaultValue={lesson.markdown ?? ""} id="markdown" name="markdown" rows={8} />
            </div>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn btn-primary" type="submit">
                Сохранить
              </button>
            </div>
          </form>

          <section className="card stack">
            <div>
              <h3>Материалы</h3>
              <p className="text-muted">Ссылки на PDF, чек-листы и дополнительные документы</p>
            </div>
            {lesson.attachments.length === 0 ? (
              <p className="text-muted">Дополнительных материалов нет</p>
            ) : (
              <div className="stack">
                {lesson.attachments.map((attachment) => (
                  <div className="attachment-row" key={attachment.id}>
                    <a className="row" href={attachment.url} rel="noreferrer" target="_blank">
                      <Paperclip size={16} />
                      <span>{attachment.title}</span>
                    </a>
                    <form action={deleteAttachmentAction}>
                      <input name="attachmentId" type="hidden" value={attachment.id} />
                      <button className="btn btn-icon btn-ghost btn-danger" title="Удалить" type="submit">
                        <Trash2 size={17} />
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}

            <form action={addAttachmentAction} className="admin-form">
              <input name="lessonId" type="hidden" value={lesson.id} />
              <div className="row">
                <div className="field field-half">
                  <label htmlFor="attachment-title">Название</label>
                  <input className="input" id="attachment-title" name="title" required />
                </div>
                <div className="field field-half">
                  <label htmlFor="attachment-url">URL</label>
                  <input className="input" id="attachment-url" name="url" placeholder="https://example.com/test.pdf" required type="url" />
                </div>
              </div>
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <button className="btn btn-accent btn-sm" type="submit">
                  Добавить материал
                </button>
              </div>
            </form>
          </section>

          <section className="card stack">
            <div>
              <h3>Тест к уроку</h3>
              <p className="text-muted">Тест закрепляет материал конкретного урока. Логика обязательного прохождения будет подключена позже.</p>
            </div>
            {lesson.test ? (
              <div className="stack">
                <p className="text-muted">
                  {lesson.test._count.questions} вопросов · {lesson.test.passPercent}% проходной · {lesson.test.maxAttempts} попытки
                </p>
                <Link className="btn btn-primary" href={`/admin/courses/${lesson.course.id}/lessons/${lesson.id}/test`}>
                  Открыть редактор теста →
                </Link>
              </div>
            ) : (
              <div className="stack">
                <p className="text-muted">У урока ещё нет теста. Создайте, чтобы менеджеры закрепили материал.</p>
                <form action={createTestAction} className="stack">
                  <input name="courseId" type="hidden" value={lesson.course.id} />
                  <input name="lessonId" type="hidden" value={lesson.id} />
                  <input name="title" type="hidden" value={`Тест: ${lesson.title}`} />
                  <input name="passPercent" type="hidden" value={70} />
                  <input name="maxAttempts" type="hidden" value={2} />
                  <button className="btn btn-accent" type="submit">
                    Создать тест к уроку
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
