import Link from "next/link";
import type { Route } from "next";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonVariant = "ghost" | "danger" | "primary";

type IconButtonProps = {
  children: ReactNode;
  className?: string;
  href?: string;
  label?: string;
  variant?: IconButtonVariant;
} & ButtonHTMLAttributes<HTMLButtonElement>;

function variantClass(variant: IconButtonVariant) {
  if (variant === "danger") {
    return "btn-danger";
  }

  if (variant === "primary") {
    return "btn-primary";
  }

  return "btn-ghost";
}

export function IconButton({ children, className = "", href, label, variant = "ghost", ...buttonProps }: IconButtonProps) {
  const classes = `btn btn-icon ${variantClass(variant)} ${className}`.trim();

  if (href) {
    return (
      <Link aria-label={label} className={classes} href={href as Route} title={label}>
        {children}
      </Link>
    );
  }

  return (
    <button aria-label={label} className={classes} title={label} type="button" {...buttonProps}>
      {children}
    </button>
  );
}
