import { LogOut } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { PortalSidebar } from "@/components/portal/PortalSidebar";
import { RopSidebar } from "@/components/rop/RopSidebar";
import { Avatar } from "@/components/ui/Avatar";
import { logoutAction } from "@/lib/auth/actions";
import { getSession, requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

type PortalLayoutProps = {
  children: ReactNode;
};

export default async function PortalLayout({ children }: PortalLayoutProps) {
  const payload = await getSession();

  if (payload) {
    const pendingUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { status: true, onboardingStatus: true }
    });

    if (pendingUser?.status === "PENDING") {
      if (pendingUser.onboardingStatus === "PENDING_VIDEO") {
        redirect("/onboarding");
      }

      if (pendingUser.onboardingStatus === "DECLINED") {
        redirect("/onboarding/declined");
      }

      redirect("/onboarding/pending");
    }
  }

  const session = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      firstName: true,
      lastName: true,
      role: true,
      avatarUrl: true,
      department: { select: { name: true } }
    }
  });

  if (!user) {
    throw new Error("User not found");
  }

  const fullName = `${user.firstName} ${user.lastName}`;
  const titleAttr = `${fullName}${user.department?.name ? ` · ${user.department.name}` : ""}`;

  const footer = (
    <div className="portal-sidebar-footer">
      <Link href={session.role === "ROP" ? "/profile" : "/profile"} title={titleAttr}>
        <Avatar user={user} size={40} />
      </Link>
      <form action={logoutAction}>
        <button className="btn btn-icon btn-ghost" title="Выйти" type="submit">
          <LogOut size={20} />
        </button>
      </form>
    </div>
  );

  if (session.role === "ROP") {
    const ropItems = [
      { href: "/team", label: "Дашборд", icon: "BarChart3" as const },
      { href: "/team/managers", label: "Менеджеры", icon: "Users" as const },
      { href: "/team/applications", label: "Заявки", icon: "Inbox" as const },
      { href: "/team/review", label: "Проверка", icon: "ClipboardCheck" as const },
      { href: "/", label: "Мои курсы", icon: "BookOpen" as const },
      { href: "/profile", label: "Профиль", icon: "UserCircle2" as const }
    ];

    return (
      <div className="portal-shell">
        <RopSidebar items={ropItems} footer={footer} />
        <main className="portal-main">{children}</main>
      </div>
    );
  }

  const managerItems = [
    { href: "/", label: "Мои курсы", icon: "BookOpen" as const },
    { href: "/profile", label: "Профиль", icon: "UserCircle2" as const },
    ...(session.role === "ADMIN" ? [{ href: "/admin", label: "Админка", icon: "ShieldCheck" as const }] : [])
  ];

  return (
    <div className="portal-shell">
      <PortalSidebar items={managerItems} footer={footer} />
      <main className="portal-main">{children}</main>
    </div>
  );
}
