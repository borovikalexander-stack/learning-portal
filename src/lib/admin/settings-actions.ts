"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

const onboardingSettingsSchema = z.object({
  onboardingKinescopeId: z.string().trim().optional(),
  onboardingTitle: z.string().trim().min(1).max(120),
  onboardingText: z.string().trim().min(1).max(2000),
  declineMessage: z.string().trim().min(1).max(2000)
});

export async function updateOnboardingSettingsAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const parsed = onboardingSettingsSchema.parse({
    onboardingKinescopeId: formData.get("onboardingKinescopeId") || undefined,
    onboardingTitle: formData.get("onboardingTitle"),
    onboardingText: formData.get("onboardingText"),
    declineMessage: formData.get("declineMessage")
  });

  const existing = await prisma.settings.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true }
  });

  const data = {
    ...parsed,
    onboardingKinescopeId: parsed.onboardingKinescopeId || null
  };

  if (existing) {
    await prisma.settings.update({
      where: { id: existing.id },
      data
    });
  } else {
    await prisma.settings.create({ data });
  }

  revalidatePath("/admin/settings");
  revalidatePath("/onboarding");
}
