import "server-only";

import type { UserRole } from "@prisma/client";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export type SessionPayload = {
  userId: string;
  role: "ADMIN" | "MANAGER" | "CURATOR" | "ROP";
};

export type ActiveSession = {
  userId: string;
  role: UserRole;
  departmentId: string | null;
};

const cookieName = "session";

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("AUTH_SECRET is required");
  }

  return new TextEncoder().encode(secret);
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecretKey());

  const cookieStore = await cookies();

  cookieStore.set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(cookieName)?.value;

    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(token, getSecretKey());

    if (
      typeof payload.userId !== "string" ||
      (payload.role !== "ADMIN" && payload.role !== "MANAGER" && payload.role !== "CURATOR" && payload.role !== "ROP")
    ) {
      return null;
    }

    return {
      userId: payload.userId,
      role: payload.role
    };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(cookieName);
}

export async function requireSession(): Promise<ActiveSession> {
  const payload = await getSession();

  if (!payload) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, role: true, status: true, departmentId: true }
  });

  if (!user || user.status !== "ACTIVE") {
    // Cookie deletion happens via logoutAction (server action context).
    // From a server component context, just redirect — the stale cookie
    // cannot pass the DB check next time anyway.
    redirect("/login");
  }

  return {
    userId: user.id,
    role: user.role,
    departmentId: user.departmentId
  };
}

export async function requireAdmin(): Promise<ActiveSession> {
  const session = await requireSession();

  if (session.role !== "ADMIN") {
    redirect("/");
  }

  return session;
}
