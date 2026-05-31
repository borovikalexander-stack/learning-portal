"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export type RegistrationState = {
  error?: string;
  success?: boolean;
};

const registrationSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(100),
  departmentSlug: z.string().trim().min(1)
});

export async function registerAction(
  _prev: RegistrationState,
  formData: FormData
): Promise<RegistrationState> {
  const parsed = registrationSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    password: formData.get("password"),
    departmentSlug: formData.get("departmentSlug")
  });

  if (!parsed.success) {
    return { error: "Проверьте данные заявки" };
  }

  let createdUser: { id: string } | null = null;

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: parsed.data.email }
    });

    if (existingUser) {
      return { error: "Такой email уже зарегистрирован" };
    }

    const department = await prisma.department.findUnique({
      where: { slug: parsed.data.departmentSlug }
    });

    if (!department) {
      return { error: "Отдел не найден" };
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);

    createdUser = await prisma.user.create({
      data: {
        email: parsed.data.email,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        passwordHash,
        role: "MANAGER",
        status: "PENDING",
        onboardingStatus: "PENDING_VIDEO",
        requestedDept: parsed.data.departmentSlug
      },
      select: { id: true }
    });
  } catch (error) {
    console.error(error);
    return { error: "Не удалось отправить заявку" };
  }

  if (!createdUser) {
    return { error: "Не удалось отправить заявку" };
  }

  await createSession({ userId: createdUser.id, role: "MANAGER" });
  redirect("/onboarding");
}
