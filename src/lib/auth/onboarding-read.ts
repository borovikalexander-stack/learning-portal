import "server-only";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function getPendingOnboardingUser() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, status: true, onboardingStatus: true }
  });

  if (!user) {
    redirect("/login");
  }

  if (user.status !== "PENDING") {
    redirect("/");
  }

  return user;
}
