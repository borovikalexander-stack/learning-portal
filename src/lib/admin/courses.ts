"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

const courseSchema = z.object({
  slug: z.string().trim().min(3).max(60).regex(/^[a-z0-9-]+$/),
  title: z.string().trim().min(3),
  description: z.string().trim().min(1),
  departmentId: z.string().trim().min(1),
  estimatedMins: z.coerce.number().int().min(1).max(1000),
  accent: z.string().trim().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/),
  isDefault: z.boolean()
});

function parseCourseForm(formData: FormData) {
  return courseSchema.parse({
    slug: formData.get("slug"),
    title: formData.get("title"),
    description: formData.get("description"),
    departmentId: formData.get("departmentId"),
    estimatedMins: formData.get("estimatedMins"),
    accent: formData.get("accent"),
    isDefault: formData.get("isDefault") === "on"
  });
}

async function ensureUniqueSlug(slug: string, currentId?: string) {
  const existing = await prisma.course.findUnique({
    where: { slug },
    select: { id: true }
  });

  if (existing && existing.id !== currentId) {
    throw new Error("Курс с таким slug уже существует");
  }
}

function revalidateCourseAdmin(id: string) {
  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${id}`);
}

export async function createCourseAction(formData: FormData) {
  await requireAdmin();

  const data = parseCourseForm(formData);
  await ensureUniqueSlug(data.slug);

  const course = await prisma.course.create({
    data: {
      ...data,
      status: "DRAFT"
    },
    select: { id: true }
  });

  revalidatePath("/admin/courses");
  redirect(`/admin/courses/${course.id}`);
}

export async function updateCourseAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const data = parseCourseForm(formData);

  if (!id) {
    return;
  }

  await ensureUniqueSlug(data.slug, id);

  await prisma.course.update({
    where: { id },
    data
  });

  revalidateCourseAdmin(id);
  revalidatePath("/");
}

export async function publishCourseAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");

  if (!id) {
    return;
  }

  await prisma.course.update({
    where: { id },
    data: { status: "PUBLISHED" }
  });

  revalidateCourseAdmin(id);
}

export async function unpublishCourseAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");

  if (!id) {
    return;
  }

  await prisma.course.update({
    where: { id },
    data: { status: "DRAFT" }
  });

  revalidateCourseAdmin(id);
}

export async function archiveCourseAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");

  if (!id) {
    return;
  }

  await prisma.course.update({
    where: { id },
    data: { status: "ARCHIVED" }
  });

  revalidateCourseAdmin(id);
}

export async function deleteCourseAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");

  if (!id) {
    return;
  }

  const course = await prisma.course.findUnique({
    where: { id },
    select: { status: true }
  });

  if (!course) {
    return;
  }

  if (course.status === "PUBLISHED") {
    throw new Error("Опубликованный курс нельзя удалить, сначала снимите с публикации");
  }

  await prisma.$transaction(async (tx) => {
    await tx.answerAttempt.deleteMany({
      where: {
        question: {
          test: { courseId: id }
        }
      }
    });
    await tx.testAttempt.deleteMany({
      where: {
        test: { courseId: id }
      }
    });
    await tx.question.deleteMany({
      where: {
        test: { courseId: id }
      }
    });
    await tx.test.deleteMany({ where: { courseId: id } });
    await tx.lessonProgress.deleteMany({
      where: {
        lesson: { courseId: id }
      }
    });
    await tx.lessonAttachment.deleteMany({
      where: {
        lesson: { courseId: id }
      }
    });
    await tx.lesson.deleteMany({ where: { courseId: id } });
    await tx.courseAccess.deleteMany({ where: { courseId: id } });
    await tx.enrollment.deleteMany({ where: { courseId: id } });
    await tx.course.delete({ where: { id } });
  });

  revalidatePath("/admin/courses");
  revalidatePath("/");
  redirect("/admin/courses");
}
