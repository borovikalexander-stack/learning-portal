"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import type { registerAction } from "@/lib/auth/registration";

type RegisterFormProps = {
  action: typeof registerAction;
  departments: { slug: string; name: string }[];
};

export function RegisterForm({ action, departments }: RegisterFormProps) {
  const [state, formAction] = useFormState(action, {});

  return (
    <div className="card auth-card">
      <form action={formAction}>
        <div className="auth-card-head">
          <p className="eyebrow">Заявка</p>
          <h2>Получить доступ</h2>
          <p className="text-muted">Заполните данные, администратор проверит заявку и назначит отдел.</p>
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="firstName">Имя</label>
            <input className="input" id="firstName" name="firstName" autoComplete="given-name" required />
          </div>
          <div className="field">
            <label htmlFor="lastName">Фамилия</label>
            <input className="input" id="lastName" name="lastName" autoComplete="family-name" required />
          </div>
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="field">
          <label htmlFor="password">Пароль</label>
          <input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          <span className="hint">Минимум 8 символов</span>
        </div>
        <div className="field">
          <label htmlFor="departmentSlug">Отдел</label>
          <select
            className="select"
            id="departmentSlug"
            name="departmentSlug"
            defaultValue={departments[0]?.slug ?? ""}
            required
          >
            {departments.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        {state.error ? <p className="badge badge-danger">{state.error}</p> : null}
        <button className="btn btn-primary" style={{ width: "100%" }} type="submit">
          Отправить заявку
        </button>
        <p className="auth-card-footer">
          Уже есть аккаунт? <Link href="/login">Войти</Link>
        </p>
      </form>
    </div>
  );
}
