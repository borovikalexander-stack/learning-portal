"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <main className="auth-shell" style={{ display: "grid", placeItems: "center", padding: 48 }}>
      <section className="card stack" style={{ maxWidth: 480, textAlign: "center" }}>
        <div style={{ display: "grid", placeItems: "center", marginBottom: 12 }}>
          <span
            className="auth-brand-icon"
            style={{ background: "var(--danger-soft)", color: "var(--danger)", width: 64, height: 64 }}
          >
            <AlertCircle size={32} />
          </span>
        </div>
        <h1>Что-то пошло не так</h1>
        <p className="text-muted">
          Мы записали ошибку и разберёмся. Попробуйте обновить страницу или вернуться назад.
        </p>
        {error.digest ? (
          <p className="text-muted" style={{ fontSize: 12, fontFamily: "ui-monospace, monospace" }}>
            ID: {error.digest}
          </p>
        ) : null}
        <div className="row" style={{ justifyContent: "center", flexWrap: "wrap" }}>
          <button className="btn btn-accent" onClick={reset} type="button">
            Попробовать снова
          </button>
          <Link className="btn btn-secondary" href="/">
            На главную
          </Link>
        </div>
      </section>
    </main>
  );
}
