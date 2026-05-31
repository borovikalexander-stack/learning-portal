"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { markLessonComplete } from "@/lib/portal/learning";
import { submitTestAttempt } from "@/lib/portal/testing";

export async function markLessonCompleteAction(formData: FormData) {
  const session = await requireSession();
  const lessonId = String(formData.get("lessonId") ?? "");
  const courseSlug = String(formData.get("courseSlug") ?? "");

  if (!lessonId) {
    return;
  }

  await markLessonComplete(session.userId, lessonId);
  revalidatePath(`/courses/${courseSlug}`);
  revalidatePath("/");
  redirect(`/courses/${courseSlug}/lessons/${lessonId}`);
}

export async function submitTestAttemptAction(formData: FormData) {
  const session = await requireSession();
  const testId = String(formData.get("testId") ?? "");
  const courseSlug = String(formData.get("courseSlug") ?? "");
  const lessonId = String(formData.get("lessonId") ?? "");

  if (!testId || !courseSlug) {
    redirect(`/courses/${courseSlug || ""}`);
  }

  const result = await submitTestAttempt(session.userId, testId, formData);
  if (!result.ok) {
    // simplest: redirect to course with no detailed error UI; could be improved
    redirect(`/courses/${courseSlug}`);
  }

  if (lessonId) {
    redirect(`/courses/${courseSlug}/lessons/${lessonId}/test/results/${result.attemptId}`);
  }
  redirect(`/courses/${courseSlug}/test/results/${result.attemptId}`);
}
