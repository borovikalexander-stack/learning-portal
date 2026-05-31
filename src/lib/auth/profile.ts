"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

const profileSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60)
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(100),
    confirmPassword: z.string()
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Пароли не совпадают",
    path: ["confirmPassword"]
  });

const MAX_AVATAR_SIZE = 3 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

export type ProfileState = {
  error?: string;
  success?: string;
};

export async function updateProfileAction(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const session = await requireSession();

  const parsed = profileSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName")
  });

  if (!parsed.success) {
    return { error: "Имя и фамилия не должны быть пустыми" };
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: parsed.data
  });

  revalidatePath("/profile");
  revalidatePath("/admin/profile");
  revalidatePath("/");
  revalidatePath("/admin");
  return { success: "Профиль обновлён" };
}

export async function changePasswordAction(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const session = await requireSession();

  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword")
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.path[0] === "confirmPassword") {
      return { error: "Пароли не совпадают" };
    }
    if (issue?.path[0] === "newPassword") {
      return { error: "Новый пароль должен быть не короче 8 символов" };
    }
    return { error: "Заполните все поля" };
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) {
    return { error: "Пользователь не найден" };
  }

  const matches = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!matches) {
    return { error: "Текущий пароль введён неверно" };
  }

  const newHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash }
  });

  return { success: "Пароль обновлён" };
}

function avatarStorageDir() {
  return path.join(process.cwd(), "public", "uploads", "avatars");
}

async function removeExistingAvatarFile(currentUrl: string | null | undefined) {
  if (!currentUrl) return;
  const filename = path.basename(currentUrl);
  if (!filename || filename === ".gitkeep") return;
  const full = path.join(avatarStorageDir(), filename);
  try {
    await unlink(full);
  } catch {
    // ignore if file no longer exists
  }
}

export async function uploadAvatarAction(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const session = await requireSession();

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Файл не выбран" };
  }

  if (file.size > MAX_AVATAR_SIZE) {
    return { error: "Файл больше 3 МБ" };
  }

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return { error: "Поддерживаются только JPG, PNG, WEBP" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const dir = avatarStorageDir();
  await mkdir(dir, { recursive: true });

  const filename = `${session.userId}-${Date.now()}.${ext}`;
  const filepath = path.join(dir, filename);
  await writeFile(filepath, buffer);

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { avatarUrl: true }
  });
  await removeExistingAvatarFile(user?.avatarUrl);

  const publicUrl = `/uploads/avatars/${filename}`;
  await prisma.user.update({
    where: { id: session.userId },
    data: { avatarUrl: publicUrl }
  });

  revalidatePath("/profile");
  revalidatePath("/admin/profile");
  revalidatePath("/");
  revalidatePath("/admin");
  return { success: "Аватар обновлён" };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function removeAvatarAction(prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const session = await requireSession();

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { avatarUrl: true }
  });

  await removeExistingAvatarFile(user?.avatarUrl);
  await prisma.user.update({
    where: { id: session.userId },
    data: { avatarUrl: null }
  });

  revalidatePath("/profile");
  revalidatePath("/admin/profile");
  revalidatePath("/");
  revalidatePath("/admin");
  return { success: "Аватар удалён" };
}
