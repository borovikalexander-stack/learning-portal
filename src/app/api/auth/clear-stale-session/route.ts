import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

async function clearStaleSession() {
  const session = await getSession();

  if (!session) {
    return false;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, status: true }
  });

  if (!user || user.status === "BLOCKED") {
    const cookieStore = await cookies();
    cookieStore.delete("session");
    return true;
  }

  return false;
}

export async function GET(request: NextRequest) {
  await clearStaleSession();
  const next = request.nextUrl.searchParams.get("next") || "/login";
  return NextResponse.redirect(new URL(next, request.url));
}

export async function POST() {
  const cleared = await clearStaleSession();
  return NextResponse.json({ cleared });
}
