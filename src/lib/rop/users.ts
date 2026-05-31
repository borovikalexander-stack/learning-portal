"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

async function assertRopAndScope(targetUserId: string) {
  const session = await requireSession();
  if (session.role !== "ROP") {
    throw new Error("Доступ только для РОП");
  }

  const rop = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { departmentId: true, department: { select: { slug: true } } }
  });

  if (!rop?.departmentId) {
    throw new Error("РОП не привязан к отделу");
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, role: true, status: true, departmentId: true, requestedDept: true, avatarUrl: true }
  });

  if (!target) {
    throw new Error("Пользователь не найден");
  }

  if (target.role === "ADMIN" || target.id === session.userId) {
    throw new Error("Действие недоступно");
  }

  return { session, rop, target };
}

export async function ropApproveUserAction(formData: FormData): Promise<void> {
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;

  const { rop, target } = await assertRopAndScope(userId);

  if (target.status !== "PENDING") return;
  if (target.requestedDept !== rop.department?.slug) {
    throw new Error("Заявка не относится к вашему отделу");
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: target.id },
      data: {
        status: "ACTIVE",
        departmentId: rop.departmentId,
        requestedDept: null
      }
    });

    const defaultCourses = await tx.course.findMany({
      where: {
        departmentId: rop.departmentId ?? undefined,
        status: "PUBLISHED",
        isDefault: true
      },
      select: { id: true }
    });

    if (defaultCourses.length > 0) {
      await tx.courseAccess.createMany({
        data: defaultCourses.map((c) => ({
          userId: target.id,
          courseId: c.id,
          source: "DEPARTMENT_DEFAULT"
        })),
        skipDuplicates: true
      });
    }
  });

  revalidatePath("/team");
  revalidatePath("/team/applications");
  revalidatePath("/team/managers");
}

export async function ropRejectUserAction(formData: FormData): Promise<void> {
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;

  const { rop, target } = await assertRopAndScope(userId);

  if (target.status !== "PENDING") return;
  if (target.requestedDept !== rop.department?.slug) {
    throw new Error("Заявка не относится к вашему отделу");
  }

  await prisma.user.update({
    where: { id: target.id },
    data: { status: "BLOCKED", requestedDept: null }
  });

  revalidatePath("/team");
  revalidatePath("/team/applications");
}

export async function ropBlockManagerAction(formData: FormData): Promise<void> {
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;

  const { rop, target } = await assertRopAndScope(userId);

  if (target.role !== "MANAGER" || target.departmentId !== rop.departmentId) {
    throw new Error("Менеджер не из вашего отдела");
  }

  if (target.status !== "ACTIVE") return;

  await prisma.user.update({
    where: { id: target.id },
    data: { status: "BLOCKED" }
  });

  revalidatePath("/team/managers");
  revalidatePath(`/team/managers/${userId}`);
}

export async function ropUnblockManagerAction(formData: FormData): Promise<void> {
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return;

  const { rop, target } = await assertRopAndScope(userId);

  if (target.role !== "MANAGER" || target.departmentId !== rop.departmentId) {
    throw new Error("Менеджер не из вашего отдела");
  }

  if (target.status !== "BLOCKED") return;

  await prisma.user.update({
    where: { id: target.id },
    data: { status: "ACTIVE" }
  });

  revalidatePath("/team/managers");
  revalidatePath(`/team/managers/${userId}`);
}

export async function ropGrantCourseAction(formData: FormData): Promise<void> {
  const userId = String(formData.get("userId") ?? "");
  const courseId = String(formData.get("courseId") ?? "");
  if (!userId || !courseId) return;

  const { rop, target, session } = await assertRopAndScope(userId);

  if (target.role !== "MANAGER" || target.departmentId !== rop.departmentId) {
    throw new Error("Менеджер не из вашего отдела");
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, status: true, departmentId: true }
  });

  if (!course || course.status !== "PUBLISHED") {
    throw new Error("Курс недоступен для назначения");
  }

  if (course.departmentId !== rop.departmentId) {
    throw new Error("Курс не относится к вашему отделу");
  }

  await prisma.courseAccess.upsert({
    where: { userId_courseId: { userId: target.id, courseId } },
    update: { source: "MANUAL_GRANT", grantedBy: session.userId },
    create: {
      userId: target.id,
      courseId,
      source: "MANUAL_GRANT",
      grantedBy: session.userId
    }
  });

  revalidatePath(`/team/managers/${userId}`);
}

export async function ropRevokeCourseAction(formData: FormData): Promise<void> {
  const userId = String(formData.get("userId") ?? "");
  const courseId = String(formData.get("courseId") ?? "");
  if (!userId || !courseId) return;

  const { rop, target } = await assertRopAndScope(userId);

  if (target.role !== "MANAGER" || target.departmentId !== rop.departmentId) {
    throw new Error("Менеджер не из вашего отдела");
  }

  await prisma.courseAccess.deleteMany({
    where: { userId: target.id, courseId }
  });

  revalidatePath(`/team/managers/${userId}`);
}
