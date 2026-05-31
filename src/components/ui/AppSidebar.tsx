"use client";

import { type LucideIcon } from "lucide-react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

type AppSidebarProps = {
  items: { href: string; label: string; icon: LucideIcon }[];
  activeHref: string;
  footer?: ReactNode;
};

export function AppSidebar({ items, activeHref, footer }: AppSidebarProps) {
  return (
    <aside className="app-sidebar">
      <div className="app-sidebar-logo" title="DSS Group">
        <Image alt="DSS Group" height={38} priority src="/dss-logo-white.svg" width={60} />
      </div>
      <nav className="app-sidebar-nav" aria-label="Основная навигация">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              aria-label={item.label}
              className={`app-sidebar-link ${activeHref === item.href ? "active" : ""}`}
              href={item.href as Route}
              key={item.href}
              title={item.label}
            >
              <Icon size={22} />
            </Link>
          );
        })}
      </nav>
      {footer ? <div className="app-sidebar-footer">{footer}</div> : null}
    </aside>
  );
}
