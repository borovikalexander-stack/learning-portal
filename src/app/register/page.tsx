import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { registerAction } from "@/lib/auth/registration";
import { prisma } from "@/lib/db";
import { RegisterForm } from "./RegisterForm";

export default async function RegisterPage() {
  const session = await getSession();

  if (session) {
    redirect("/");
  }

  const departments = await prisma.department.findMany({
    orderBy: { name: "asc" },
    select: { slug: true, name: true }
  });

  return (
    <main className="auth-shell">
      <section className="auth-brand-panel">
        <div className="auth-brand">
          <span className="auth-brand-logo">
            <Image alt="DSS Group" height={40} priority src="/dss-logo.svg" width={88} />
          </span>
        </div>
        <div className="auth-copy">
          <p className="eyebrow">Корпоративное обучение</p>
          <h1>Платформа развития команды продаж</h1>
          <p>Курсы для отделов компании. Видео, материалы, проверка знаний.</p>
        </div>
      </section>
      <section className="auth-form-panel">
        <RegisterForm action={registerAction} departments={departments} />
      </section>
    </main>
  );
}
