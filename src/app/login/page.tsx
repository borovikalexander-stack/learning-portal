import { redirect } from "next/navigation";
import { AuthShowcase } from "@/components/auth/AuthShowcase";
import { loginAction } from "@/lib/auth/actions";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const session = await getSession();

  if (session) {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, status: true, onboardingStatus: true }
    });

    if (!user || user.status === "BLOCKED") {
      redirect("/api/auth/clear-stale-session?next=/login");
    }

    if (user.status === "PENDING") {
      if (user.onboardingStatus === "PENDING_VIDEO") {
        redirect("/onboarding");
      }

      if (user.onboardingStatus === "DECLINED") {
        redirect("/onboarding/declined");
      }

      redirect("/onboarding/pending");
    }

    if (session.role === "ADMIN") {
      redirect("/admin");
    }

    if (session.role === "ROP") {
      redirect("/team");
    }

    redirect("/");
  }

  return (
    <main className="auth-shell">
      <AuthShowcase />
      <section className="auth-form-panel">
        <LoginForm action={loginAction} />
      </section>
    </main>
  );
}
