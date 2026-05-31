"use client";

import { BarChart3, BookOpen, ClipboardCheck, Inbox, UserCircle2, Users, type LucideIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppSidebar } from "@/components/ui/AppSidebar";

type RopSidebarItem = {
  href: string;
  label: string;
  icon: "BarChart3" | "Users" | "Inbox" | "BookOpen" | "UserCircle2" | "ClipboardCheck";
};

type RopSidebarProps = {
  items: RopSidebarItem[];
  footer?: ReactNode;
};

const icons: Record<RopSidebarItem["icon"], LucideIcon> = {
  BarChart3,
  Users,
  Inbox,
  BookOpen,
  UserCircle2,
  ClipboardCheck
};

function getActiveHref(pathname: string) {
  if (pathname.startsWith("/team/managers")) return "/team/managers";
  if (pathname.startsWith("/team/applications")) return "/team/applications";
  if (pathname.startsWith("/team/review")) return "/team/review";
  if (pathname.startsWith("/team")) return "/team";
  if (pathname.startsWith("/profile")) return "/profile";
  if (pathname === "/" || pathname.startsWith("/courses")) return "/";
  return pathname;
}

export function RopSidebar({ items, footer }: RopSidebarProps) {
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
