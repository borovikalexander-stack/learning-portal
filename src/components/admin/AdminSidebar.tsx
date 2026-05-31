"use client";

import { ArrowLeftToLine, BarChart3, ClipboardCheck, Layers3, Settings, UserCircle2, Users, type LucideIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppSidebar } from "@/components/ui/AppSidebar";

type AdminSidebarItem = {
  href: string;
  label: string;
  icon: "BarChart3" | "Users" | "Layers3" | "ArrowLeftToLine" | "UserCircle2" | "ClipboardCheck" | "Settings";
};

type AdminSidebarProps = {
  items: AdminSidebarItem[];
  footer?: ReactNode;
};

const icons: Record<AdminSidebarItem["icon"], LucideIcon> = {
  BarChart3,
  Users,
  Layers3,
  ArrowLeftToLine,
  UserCircle2,
  ClipboardCheck,
  Settings
};

function getActiveHref(pathname: string) {
  if (pathname.startsWith("/admin/users")) {
    return "/admin/users";
  }

  if (pathname.startsWith("/admin/courses")) {
    return "/admin/courses";
  }

  if (pathname.startsWith("/admin/review")) {
    return "/admin/review";
  }

  if (pathname.startsWith("/admin/settings")) {
    return "/admin/settings";
  }

  if (pathname.startsWith("/admin/profile")) {
    return "/admin/profile";
  }

  return "/admin";
}

export function AdminSidebar({ items, footer }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <div className="admin-sidebar">
      <AppSidebar
        activeHref={getActiveHref(pathname)}
        footer={footer}
        items={items.map((item) => ({ ...item, icon: icons[item.icon] }))}
      />
    </div>
  );
}
