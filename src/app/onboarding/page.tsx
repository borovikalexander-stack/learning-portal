import Image from "next/image";
import { redirect } from "next/navigation";
import { getSettings } from "@/lib/admin/settings";
import { acceptOnboardingAction, declineOnboardingAction } from "@/lib/auth/onboarding";
import { getPendingOnboardingUser } from "@/lib/auth/onboarding-read";

export default async function OnboardingPage() {
  const user = await getPendingOnboardingUser();

  if (user.onboardingStatus === "ACCEPTED") {
    redirect("/onboarding/pending");
  }

  if (user.onboardingStatus === "DECLINED") {
    redirect("/onboarding/declined");
  }

  const settings = await getSettings();
  const embedBase = process.env.KINESCOPE_EMBED_BASE_URL;

  return (
    <main className="onboarding-shell">
      <section className="card onboarding-card">
        <Image alt="DSS Group" className="onboarding-logo" height={72} priority src="/dss-logo-full.svg" width={112} />
        <h1>{settings.onboardingTitle}</h1>
        <div className="onboarding-video">
          {settings.onboardingKinescopeId && embedBase ? (
            <iframe
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media; gyroscope; accelerometer"
              allowFullScreen
              src={`${embedBase}/${settings.onboardingKinescopeId}`}
              title="Вводное видео"
            />
          ) : (
            <div className="onboarding-video-empty">
              Видео не настроено, обратитесь к администратору
            </div>
          )}
        </div>
        <p className="onboarding-lead">{settings.onboardingText}</p>
        <div className="onboarding-actions">
          <form action={acceptOnboardingAction}>
            <button className="btn btn-accent btn-lg" type="submit">
              Принимаю условия
            </button>
          </form>
          <form action={declineOnboardingAction}>
            <button className="btn btn-lg btn-decline" type="submit">
              Не принимаю
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
