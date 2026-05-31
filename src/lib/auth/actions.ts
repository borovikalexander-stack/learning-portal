"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, destroySession } from "@/lib/auth/session";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export type LoginState = {
  error?: string;
};

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (!parsed.success) {
    return { error: "Неверный email или пароль" };
  }

  const email = parsed.data.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    return { error: "Неверный email или пароль" };
  }

  const passwordMatches = await bcrypt.compare(parsed.data.password, user.passwordHash);

  if (!passwordMatches) {
    return { error: "Неверный email или пароль" };
  }

  if (user.status === "BLOCKED") {
    return { error: "Аккаунт заблокирован" };
  }

  if (user.status === "PENDING") {
    await createSession({ userId: user.id, role: user.role });

    if (user.onboardingStatus === "PENDING_VIDEO") {
      redirect("/onboarding");
    }

    if (user.onboardingStatus === "DECLINED") {
      redirect("/onboarding/declined");
    }

    redirect("/onboarding/pending");
  }

  if (user.status !== "ACTIVE") {
    return { error: "Неверный email или пароль" };
  }

  await createSession({ userId: user.id, role: user.role });
  if (user.role === "ADMIN") {
    redirect("/admin");
  }

  if (user.role === "ROP") {
    redirect("/team");
  }

  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
