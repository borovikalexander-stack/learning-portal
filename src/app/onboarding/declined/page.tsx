import Image from "next/image";
import { redirect } from "next/navigation";
import { getSettings } from "@/lib/admin/settings";
import { logoutAction } from "@/lib/auth/actions";
import { retryOnboardingAction } from "@/lib/auth/onboarding";
import { getPendingOnboardingUser } from "@/lib/auth/onboarding-read";

export default async function OnboardingDeclinedPage() {
  const user = await getPendingOnboardingUser();

  if (user.onboardingStatus === "PENDING_VIDEO") {
    redirect("/onboarding");
  }

  if (user.onboardingStatus === "ACCEPTED") {
    redirect("/onboarding/pending");
  }

  const settings = await getSettings();

  return (
    <main className="onboarding-shell">
      <section className="card onboarding-card">
        <Image alt="DSS Group" height={48} priority src="/dss-logo.svg" width={106} />
        <span className="badge badge-warning">Онбординг не принят</span>
        <h1>Спасибо за честный ответ</h1>
        <p className="text-muted">{settings.declineMessage}</p>
        <div className="onboarding-actions">
          <form action={retryOnboardingAction}>
            <button className="btn btn-accent" type="submit">
              Попробовать снова
            </button>
          </form>
          <form action={logoutAction}>
            <button className="btn btn-secondary" type="submit">
              Выйти
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
