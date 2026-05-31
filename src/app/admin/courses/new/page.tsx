import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { createCourseAction } from "@/lib/admin/courses";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function NewCoursePage() {
  await requireAdmin();

  const departments = await prisma.department.findMany({
    orderBy: { name: "asc" }
  });

  return (
    <div className="stack">
      <PageHeader
        actions={
          <Link className="btn btn-secondary" href="/admin/courses">
            ← К списку
          </Link>
        }
        eyebrow="Курсы"
        title="Новый курс"
      >
        <p className="text-muted">Создайте черновик — содержимое можно добавить после</p>
      </PageHeader>

      <form action={createCourseAction} className="stack">
        <div className="editor-grid">
          <div className="stack">
            <section className="card stack">
              <div>
                <h3>Основное</h3>
                <p className="text-muted">Название, URL и короткое описание курса</p>
              </div>
              <div className="field">
                <label htmlFor="slug">Идентификатор (slug)</label>
                <input className="input" id="slug" name="slug" placeholder="course-name" required />
                <p className="card-helper">Латиница, цифры, тире. Используется в URL: /courses/&lt;slug&gt;.</p>
              </div>
              <div className="field">
                <label htmlFor="title">Название</label>
                <input className="input" id="title" name="title" placeholder="Например: Основы продаж" required />
              </div>
              <div className="field">
                <label htmlFor="description">Описание</label>
                <textarea
                  className="textarea"
                  id="description"
                  name="description"
                  placeholder="Короткое описание о чем курс"
                  required
                  rows={4}
                />
              </div>
            </section>

            <section className="card stack">
              <div>
                <h3>Внешний вид</h3>
                <p className="text-muted">Акцентный цвет и ожидаемая длительность</p>
              </div>
              <div className="field">
                <label htmlFor="estimatedMins">Длительность (мин)</label>
                <input className="input" defaultValue={60} id="estimatedMins" min={1} max={1000} name="estimatedMins" required type="number" />
              </div>
              <div className="field">
                <label htmlFor="accent">Цвет акцента</label>
                <label className="color-picker" htmlFor="accent">
                  <input
                    className="color-picker-input"
                    defaultValue="#0066CC"
                    id="accent"
                    name="accent"
                    required
                    type="color"
                  />
                  <span className="color-picker-swatch" aria-hidden style={{ background: "#0066CC" }} />
                  <span className="color-picker-value">#0066CC</span>
                </label>
                <p className="card-helper">Используется в карточке курса у менеджера</p>
              </div>
            </section>

            <section className="card stack">
              <div>
                <h3>Структура</h3>
                <p className="text-muted">Уроки, видео и материалы добавляются после создания черновика.</p>
              </div>
              <span className="badge badge-accent">Следующий шаг: редактор уроков</span>
            </section>
          </div>

          <div className="stack">
            <section className="card stack">
              <div>
                <h3>Доступ</h3>
                <p className="text-muted">Отдел и правило назначения курса</p>
              </div>
              <div className="field">
                <label htmlFor="departmentId">Отдел</label>
                <select className="select" id="departmentId" name="departmentId" required>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
                <p className="card-helper">Курс будет доступен менеджерам этого отдела.</p>
              </div>
              <label className="field-checkbox">
                <input defaultChecked name="isDefault" type="checkbox" />
                <span>Назначать всем новым менеджерам отдела автоматически</span>
              </label>
              <p className="card-helper">Существующим менеджерам потребуется ручное назначение.</p>
            </section>

            <section className="card card-dark stack">
              <h3>Что дальше</h3>
              <p className="text-muted">
                После создания вы попадёте в редактор. Там можно добавить уроки, прикрепить материалы, и опубликовать курс.
              </p>
            </section>
          </div>
        </div>

        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn btn-accent btn-lg" type="submit">
            Создать черновик
          </button>
        </div>
      </form>
    </div>
  );
}
