import { PageHeader } from "@/components/ui/PageHeader";
import { getSettings } from "@/lib/admin/settings";
import { updateOnboardingSettingsAction } from "@/lib/admin/settings-actions";
import { requireAdmin } from "@/lib/auth/session";

export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = await getSettings();
  const embedBase = process.env.KINESCOPE_EMBED_BASE_URL;

  return (
    <div className="stack">
      <PageHeader eyebrow="Настройки" title="Онбординг новых сотрудников">
        <p className="text-muted">Настройте вводное видео и тексты для регистрации новых менеджеров.</p>
      </PageHeader>

      <section className="grid grid-2">
        <form action={updateOnboardingSettingsAction} className="card stack">
          <div className="field">
            <label htmlFor="onboardingKinescopeId">Kinescope ID вводного видео</label>
            <input
              className="input"
              defaultValue={settings.onboardingKinescopeId ?? ""}
              id="onboardingKinescopeId"
              name="onboardingKinescopeId"
              placeholder="demo-founder-01"
            />
            <span className="hint">ID видео-обращения основателя. Менеджеры увидят его при регистрации.</span>
          </div>
          <div className="field">
            <label htmlFor="onboardingTitle">Заголовок</label>
            <input
              className="input"
              defaultValue={settings.onboardingTitle}
              id="onboardingTitle"
              name="onboardingTitle"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="onboardingText">Текст под видео</label>
            <textarea
              className="textarea"
              defaultValue={settings.onboardingText}
              id="onboardingText"
              name="onboardingText"
              required
              rows={5}
            />
          </div>
          <div className="field">
            <label htmlFor="declineMessage">Сообщение при отказе</label>
            <textarea
              className="textarea"
              defaultValue={settings.declineMessage}
              id="declineMessage"
              name="declineMessage"
              required
              rows={4}
            />
          </div>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn btn-primary" type="submit">
              Сохранить
            </button>
          </div>
        </form>

        <aside className="card stack">
          <div>
            <h3>Превью видео</h3>
            <p className="text-muted">Так видео будет отображаться на странице онбординга.</p>
          </div>
          <div className="onboarding-video">
            {settings.onboardingKinescopeId && embedBase ? (
              <iframe
                allow="autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer"
                allowFullScreen
                src={`${embedBase}/${settings.onboardingKinescopeId}`}
                title="Превью вводного видео"
              />
            ) : (
              <div className="onboarding-video-empty">Kinescope ID пока не задан</div>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}
