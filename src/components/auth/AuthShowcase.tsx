import Image from "next/image";

export function AuthShowcase() {
  return (
    <section className="auth-brand-panel auth-showcase-panel" aria-label="DSS Learning Portal">
      <div className="auth-showcase-grid" aria-hidden />
      <div className="auth-showcase-glow auth-showcase-glow-rose" aria-hidden />
      <div className="auth-showcase-glow auth-showcase-glow-smoke" aria-hidden />

      <div className="auth-showcase-header">
        <Image alt="DSS Group" height={64} priority src="/dss-logo-white.svg" width={178} />
        <span className="auth-showcase-chip">Learning Portal</span>
      </div>

      <div className="auth-showcase-copy">
        <p className="eyebrow">Корпоративное обучение</p>
        <h1>Платформа развития команды продаж</h1>
        <p>
          Курсы, уроки, тесты и аналитика для отделов автоподбора, импорта и сопровождения.
          Всё в одном спокойном рабочем пространстве.
        </p>
      </div>
    </section>
  );
}
