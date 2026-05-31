import { Compass } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="auth-shell" style={{ display: "grid", placeItems: "center", padding: 48 }}>
      <section className="card stack" style={{ maxWidth: 480, textAlign: "center" }}>
        <div style={{ display: "grid", placeItems: "center", marginBottom: 12 }}>
          <span className="auth-brand-icon" style={{ width: 64, height: 64 }}>
            <Compass size={32} />
          </span>
        </div>
        <h1>Страница не найдена</h1>
        <p className="text-muted">
          Возможно, страницу удалили или ссылка устарела. Попробуйте вернуться на главную.
        </p>
        <div className="row" style={{ justifyContent: "center", flexWrap: "wrap" }}>
          <Link className="btn btn-accent" href="/">
            На главную
          </Link>
          <Link className="btn btn-secondary" href="/login">
            Войти
          </Link>
        </div>
      </section>
    </main>
  );
}
