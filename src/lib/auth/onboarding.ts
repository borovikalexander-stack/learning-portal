"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

async function requirePendingOnboardingUser() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, status: true }
  });

  if (!user) {
    redirect("/login");
  }

  if (user.status !== "PENDING") {
    redirect("/");
  }

  return user;
}

export async function acceptOnboardingAction(): Promise<void> {
  const user = await requirePendingOnboardingUser();

  await prisma.user.update({
    where: { id: user.id },
    data: { onboardingStatus: "ACCEPTED" }
  });

  revalidatePath("/onboarding");
  revalidatePath("/onboarding/pending");
  revalidatePath("/admin/users");
  revalidatePath("/team/applications");
  redirect("/onboarding/pending");
}

export async function declineOnboardingAction(): Promise<void> {
  const user = await requirePendingOnboardingUser();

  await prisma.user.update({
    where: { id: user.id },
    data: { onboardingStatus: "DECLINED" }
  });

  revalidatePath("/onboarding");
  revalidatePath("/onboarding/declined");
  redirect("/onboarding/declined");
}

export async function retryOnboardingAction(): Promise<void> {
  const user = await requirePendingOnboardingUser();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      onboardingStatus: "PENDING_VIDEO",
      declinedOnboardingBefore: true
    }
  });

  revalidatePath("/onboarding");
  redirect("/onboarding");
}
