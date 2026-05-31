"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function grantCourseAccessAction(formData: FormData) {
  const session = await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const courseId = String(formData.get("courseId") ?? "");

  if (!userId || !courseId) {
    return;
  }

  await prisma.courseAccess.upsert({
    where: {
      userId_courseId: {
        userId,
        courseId
      }
    },
    update: {
      source: "MANUAL_GRANT",
      grantedBy: session.userId
    },
    create: {
      userId,
      courseId,
      source: "MANUAL_GRANT",
      grantedBy: session.userId
    }
  });

  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/");
}

export async function revokeCourseAccessAction(formData: FormData) {
  await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const courseId = String(formData.get("courseId") ?? "");

  if (!userId || !courseId) {
    return;
  }

  await prisma.courseAccess.deleteMany({
    where: {
      userId,
      courseId
    }
  });

  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/");
}
