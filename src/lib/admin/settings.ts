import "server-only";

import { prisma } from "@/lib/db";

export async function getSettings() {
  const settings = await prisma.settings.findFirst({
    orderBy: { createdAt: "asc" }
  });

  if (settings) {
    return settings;
  }

  return prisma.settings.create({ data: {} });
}
