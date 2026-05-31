"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

const lessonSchema = z.object({
  title: z.string().trim().min(1),
  durationMins: z.coerce.number().int().min(1).max(600),
  kinescopeId: z.string().trim().optional(),
  markdown: z.string().trim().optional()
});

const attachmentSchema = z.object({
  title: z.string().trim().min(1),
  url: z.string().trim().url()
});

function optionalText(value: string | undefined) {
  return value ? value : null;
}

function parseLessonForm(formData: FormData) {
  const parsed = lessonSchema.parse({
    title: formData.get("title"),
    durationMins: formData.get("durationMins"),
    kinescopeId: String(formData.get("kinescopeId") ?? ""),
    markdown: String(formData.get("markdown") ?? "")
  });

  return {
    title: parsed.title,
    durationMins: parsed.durationMins,
    kinescopeId: optionalText(parsed.kinescopeId),
    markdown: optionalText(parsed.markdown)
  };
}

async function revalidateCourseById(courseId: string) {
  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${courseId}`);
}

export async function createLessonAction(formData: FormData) {
  await requireAdmin();

  const courseId = String(formData.get("courseId") ?? "");
  const data = parseLessonForm(formData);

  if (!courseId) {
    return;
  }

  const lastLesson = await prisma.lesson.findFirst({
    where: { courseId },
    orderBy: { order: "desc" },
    select: { order: true }
  });

  await prisma.lesson.create({
    data: {
      ...data,
      courseId,
      order: (lastLesson?.order ?? 0) + 1,
      type: "VIDEO"
    }
  });

  await revalidateCourseById(courseId);
}

export async function updateLessonAction(formData: FormData) {
  await requireAdmin();

  const lessonId = String(formData.get("lessonId") ?? "");
  const data = parseLessonForm(formData);

  if (!lessonId) {
    return;
  }

  const lesson = await prisma.lesson.update({
    where: { id: lessonId },
    data,
    select: { courseId: true }
  });

  await revalidateCourseById(lesson.courseId);
}

export async function deleteLessonAction(formData: FormData) {
  await requireAdmin();

  const lessonId = String(formData.get("lessonId") ?? "");

  if (!lessonId) {
    return;
  }

  const courseId = await prisma.$transaction(async (tx) => {
    const lesson = await tx.lesson.findUnique({
      where: { id: lessonId },
      select: { courseId: true }
    });

    if (!lesson) {
      return null;
    }

    await tx.lessonProgress.deleteMany({ where: { lessonId } });
    await tx.lessonAttachment.deleteMany({ where: { lessonId } });
    await tx.lesson.delete({ where: { id: lessonId } });

    const remainingLessons = await tx.lesson.findMany({
      where: { courseId: lesson.courseId },
      orderBy: { order: "asc" },
      select: { id: true }
    });

    for (const [index, remainingLesson] of remainingLessons.entries()) {
      await tx.lesson.update({
        where: { id: remainingLesson.id },
        data: { order: index + 1 }
      });
    }

    return lesson.courseId;
  });

  if (courseId) {
    await revalidateCourseById(courseId);
  }
}

export async function reorderLessonAction(formData: FormData) {
  await requireAdmin();

  const lessonId = String(formData.get("lessonId") ?? "");
  const direction = String(formData.get("direction") ?? "");

  if (!lessonId || (direction !== "up" && direction !== "down")) {
    return;
  }

  const courseId = await prisma.$transaction(async (tx) => {
    const lesson = await tx.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true, courseId: true, order: true }
    });

    if (!lesson) {
      return null;
    }

    const neighbor = await tx.lesson.findFirst({
      where: {
        courseId: lesson.courseId,
        order: direction === "up" ? { lt: lesson.order } : { gt: lesson.order }
      },
      orderBy: { order: direction === "up" ? "desc" : "asc" },
      select: { id: true, order: true }
    });

    if (!neighbor) {
      return lesson.courseId;
    }

    const maxLesson = await tx.lesson.findFirst({
      where: { courseId: lesson.courseId },
      orderBy: { order: "desc" },
      select: { order: true }
    });
    const tempOrder = (maxLesson?.order ?? 0) + 1;

    await tx.lesson.update({ where: { id: lesson.id }, data: { order: tempOrder } });
    await tx.lesson.update({ where: { id: neighbor.id }, data: { order: lesson.order } });
    await tx.lesson.update({ where: { id: lesson.id }, data: { order: neighbor.order } });

    return lesson.courseId;
  });

  if (courseId) {
    await revalidateCourseById(courseId);
  }
}

export async function addAttachmentAction(formData: FormData) {
  await requireAdmin();

  const lessonId = String(formData.get("lessonId") ?? "");
  const data = attachmentSchema.parse({
    title: formData.get("title"),
    url: formData.get("url")
  });

  if (!lessonId) {
    return;
  }

  const attachment = await prisma.lessonAttachment.create({
    data: {
      lessonId,
      ...data
    },
    select: {
      lesson: {
        select: { courseId: true }
      }
    }
  });

  await revalidateCourseById(attachment.lesson.courseId);
}

export async function deleteAttachmentAction(formData: FormData) {
  await requireAdmin();

  const attachmentId = String(formData.get("attachmentId") ?? "");

  if (!attachmentId) {
    return;
  }

  const attachment = await prisma.lessonAttachment.findUnique({
    where: { id: attachmentId },
    select: {
      lesson: {
        select: { courseId: true }
      }
    }
  });

  if (!attachment) {
    return;
  }

  await prisma.lessonAttachment.delete({ where: { id: attachmentId } });
  await revalidateCourseById(attachment.lesson.courseId);
}
