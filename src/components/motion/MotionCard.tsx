import type { ComponentPropsWithoutRef } from "react";

type MotionCardProps = ComponentPropsWithoutRef<"article">;

export function MotionCard({ className = "", ...props }: MotionCardProps) {
  return <article className={`motion-card ${className}`.trim()} {...props} />;
}
