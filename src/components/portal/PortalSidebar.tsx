"use client";

import { BookOpen, ShieldCheck, UserCircle2, Users } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppSidebar } from "@/components/ui/AppSidebar";

type PortalSidebarItem = {
  href: string;
  label: string;
  icon: "BookOpen" | "ShieldCheck" | "Users" | "UserCircle2";
};

type PortalSidebarProps = {
  items: PortalSidebarItem[];
  footer?: ReactNode;
};

const icons = {
  BookOpen,
  ShieldCheck,
  Users,
  UserCircle2
};

function getActiveHref(pathname: string) {
  if (pathname === "/" || pathname.startsWith("/courses")) {
    return "/";
  }

  if (pathname.startsWith("/admin")) {
    return "/admin";
  }

  if (pathname.startsWith("/team")) {
    return "/team";
  }

  if (pathname.startsWith("/profile")) {
    return "/profile";
  }

  return pathname;
}

export function PortalSidebar({ items, footer }: PortalSidebarProps) {
  const pathname = usePathname();

  return (
    <AppSidebar
      activeHref={getActiveHref(pathname)}
      footer={footer}
      items={items.map((item) => ({
        href: item.href,
        label: item.label,
        icon: icons[item.icon]
      }))}
    />
  );
}
