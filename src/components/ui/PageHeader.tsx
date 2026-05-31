import { Fragment, type ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";

export type Breadcrumb = {
  label: string;
  href?: string;
};

type PageHeaderProps = {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
  children?: ReactNode;
  breadcrumbs?: Breadcrumb[];
};

export function PageHeader({ title, eyebrow, actions, children, breadcrumbs }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header-main">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav className="breadcrumbs" aria-label="Хлебные крошки">
            {breadcrumbs.map((crumb, index) => (
              <Fragment key={`${crumb.label}-${index}`}>
                {index > 0 ? <span className="breadcrumbs-sep" aria-hidden>/</span> : null}
                {crumb.href ? (
                  <Link className="breadcrumbs-link" href={crumb.href as Route}>
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="breadcrumbs-current">{crumb.label}</span>
                )}
              </Fragment>
            ))}
          </nav>
        ) : null}
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {children ? <div className="page-header-children">{children}</div> : null}
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </header>
  );
}
