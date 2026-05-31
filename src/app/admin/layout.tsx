import { LogOut } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { Avatar } from "@/components/ui/Avatar";
import { IconButton } from "@/components/ui/IconButton";
import { logoutAction } from "@/lib/auth/actions";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

const adminItems = [
  { href: "/admin", label: "Дашборд", icon: "BarChart3" as const },
  { href: "/admin/users", label: "Менеджеры", icon: "Users" as const },
  { href: "/admin/courses", label: "Курсы", icon: "Layers3" as const },
  { href: "/admin/review", label: "Проверка", icon: "ClipboardCheck" as const },
  { href: "/admin/settings", label: "Настройки", icon: "Settings" as const },
  { href: "/admin/profile", label: "Профиль", icon: "UserCircle2" as const }
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireAdmin();
  const admin = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { firstName: true, lastName: true, avatarUrl: true }
  });

  const safeAdmin = admin ?? { firstName: "А", lastName: "Д", avatarUrl: null };
  const fullName = `${safeAdmin.firstName} ${safeAdmin.lastName}`;

  return (
    <div className="portal-shell">
      <AdminSidebar
        footer={
          <div className="portal-sidebar-footer">
            <Link href="/admin/profile" title={fullName}>
              <Avatar user={safeAdmin} size={40} />
            </Link>
            <form action={logoutAction}>
              <IconButton label="Выйти" type="submit">
                <LogOut size={18} />
              </IconButton>
            </form>
          </div>
        }
        items={adminItems}
      />
      <main className="portal-main">{children}</main>
    </div>
  );
}
