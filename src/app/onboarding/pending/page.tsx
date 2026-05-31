import Image from "next/image";
import { redirect } from "next/navigation";
import { logoutAction } from "@/lib/auth/actions";
import { getPendingOnboardingUser } from "@/lib/auth/onboarding-read";

export default async function OnboardingPendingPage() {
  const user = await getPendingOnboardingUser();

  if (user.onboardingStatus === "PENDING_VIDEO") {
    redirect("/onboarding");
  }

  if (user.onboardingStatus === "DECLINED") {
    redirect("/onboarding/declined");
  }

  return (
    <main className="onboarding-shell">
      <section className="card onboarding-card">
        <Image alt="DSS Group" height={48} priority src="/dss-logo.svg" width={106} />
        <span className="badge badge-accent">Заявка отправлена</span>
        <h1>Ожидайте подтверждения</h1>
        <p className="text-muted">
          Руководитель отдела или администратор проверит заявку. После одобрения вы сможете войти и начать обучение.
        </p>
        <form action={logoutAction}>
          <button className="btn btn-secondary" type="submit">
            Выйти
          </button>
        </form>
      </section>
    </main>
  );
}
