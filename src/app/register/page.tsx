import { redirect } from "next/navigation";
import { AuthShowcase } from "@/components/auth/AuthShowcase";
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
      <AuthShowcase />
      <section className="auth-form-panel">
        <RegisterForm action={registerAction} departments={departments} />
      </section>
    </main>
  );
}
