"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import type { loginAction } from "@/lib/auth/actions";

type LoginFormProps = {
  action: typeof loginAction;
};

export function LoginForm({ action }: LoginFormProps) {
  const [state, formAction] = useFormState(action, {});

  return (
    <div className="card auth-card">
      <form action={formAction}>
        <div className="auth-card-head">
          <p className="eyebrow">Вход</p>
          <h2>С возвращением</h2>
          <p className="text-muted">Введите рабочий email и пароль</p>
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="field">
          <label htmlFor="password">Пароль</label>
          <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        {state.error ? <p className="badge badge-danger">{state.error}</p> : null}
        <button className="btn btn-primary" style={{ width: "100%" }} type="submit">
          Войти
        </button>
        <p className="auth-card-footer">
          Нет аккаунта? <Link href="/register">Подать заявку</Link>
        </p>
      </form>
    </div>
  );
}
