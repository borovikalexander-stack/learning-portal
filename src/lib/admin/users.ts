"use server";

import { unlink } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";

async function deleteAvatarFile(avatarUrl: string | null | undefined) {
  if (!avatarUrl) return;
  const filename = path.basename(avatarUrl);
  if (!filename || filename === ".gitkeep") return;
  const full = path.join(process.cwd(), "public", "uploads", "avatars", filename);
  try {
    await unlink(full);
  } catch {
    // ignore — file already gone or unreachable
  }
}

export async function approveUserAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const userId = String(formData.get("userId") ?? "");

  if (!userId) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId }
    });

    if (!user || user.status !== "PENDING") {
      return;
    }

    const department = user.requestedDept
      ? await tx.department.findUnique({
          where: { slug: user.requestedDept }
        })
      : null;

    await tx.user.update({
      where: { id: user.id },
      data: {
        status: "ACTIVE",
        departmentId: department?.id ?? null,
        requestedDept: null
      }
    });

    if (!department) {
      return;
    }

    const defaultCourses = await tx.course.findMany({
      where: {
        departmentId: department.id,
        status: "PUBLISHED",
        isDefault: true
      },
      select: { id: true }
    });

    if (defaultCourses.length === 0) {
      return;
    }

    await tx.courseAccess.createMany({
      data: defaultCourses.map((course) => ({
        userId: user.id,
        courseId: course.id,
        source: "DEPARTMENT_DEFAULT"
      })),
      skipDuplicates: true
    });
  });

  revalidatePath("/admin/users");
}

export async function rejectUserAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const userId = String(formData.get("userId") ?? "");

  if (!userId) {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user || user.status !== "PENDING") {
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      status: "BLOCKED",
      requestedDept: null
    }
  });

  revalidatePath("/admin/users");
}

export async function blockUserAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const userId = String(formData.get("userId") ?? "");

  if (!userId) {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true }
  });

  if (!user || user.status === "BLOCKED") {
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      status: "BLOCKED",
      requestedDept: user.status === "PENDING" ? null : undefined
    }
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
}

export async function unblockUserAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const userId = String(formData.get("userId") ?? "");

  if (!userId) {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true }
  });

  if (!user || user.status !== "BLOCKED") {
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { status: "ACTIVE" }
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
}

export async function deleteUserAction(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");

  if (!userId) {
    return;
  }

  if (session.userId === userId) {
    throw new Error("Нельзя удалить себя");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, avatarUrl: true }
  });

  if (!user) {
    redirect("/admin/users");
  }

  await prisma.$transaction(async (tx) => {
    await tx.answerAttempt.updateMany({
      where: { reviewedById: userId },
      data: {
        reviewedById: null,
        reviewedAt: null
      }
    });
    await tx.answerAttempt.deleteMany({
      where: {
        attempt: { userId }
      }
    });
    await tx.testAttempt.deleteMany({ where: { userId } });
    await tx.lessonProgress.deleteMany({ where: { userId } });
    await tx.enrollment.deleteMany({ where: { userId } });
    await tx.courseAccess.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });
  });

  await deleteAvatarFile(user.avatarUrl);

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  redirect("/admin/users");
}

export async function updateUserDepartmentAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const departmentIdRaw = String(formData.get("departmentId") ?? "");
  const departmentId = departmentIdRaw || null;

  if (!userId) {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true }
  });

  if (!user) {
    return;
  }

  if (user.role === "ADMIN") {
    throw new Error("Нельзя изменить отдел администратору");
  }

  if (departmentId) {
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true }
    });

    if (!department) {
      return;
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.courseAccess.deleteMany({
      where: {
        userId,
        source: "DEPARTMENT_DEFAULT"
      }
    });

    await tx.user.update({
      where: { id: userId },
      data: { departmentId }
    });

    if (!departmentId) {
      return;
    }

    const defaultCourses = await tx.course.findMany({
      where: {
        departmentId,
        status: "PUBLISHED",
        isDefault: true
      },
      select: { id: true }
    });

    if (defaultCourses.length === 0) {
      return;
    }

    await tx.courseAccess.createMany({
      data: defaultCourses.map((course) => ({
        userId,
        courseId: course.id,
        source: "DEPARTMENT_DEFAULT" as const
      })),
      skipDuplicates: true
    });
  });

  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
  revalidatePath("/");
}

export async function updateUserRoleAction(formData: FormData): Promise<void> {
  const session = await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");

  if (!userId || (role !== "MANAGER" && role !== "ROP" && role !== "ADMIN")) {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true }
  });

  if (!user) {
    return;
  }

  if (session.userId === userId) {
    throw new Error("Нельзя изменить свою роль");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role }
  });

  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
  revalidatePath("/");
}
