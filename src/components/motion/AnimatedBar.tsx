"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

type AnimatedBarProps = {
  value: number;
  className?: string;
  barClassName?: string;
  color?: string;
  label?: string;
};

function clampProgress(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function AnimatedBar({ value, className = "progress", barClassName, color, label }: AnimatedBarProps) {
  const barRef = useRef<HTMLSpanElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const clamped = clampProgress(value);

  useGSAP(
    () => {
      const bar = barRef.current;
      if (!bar) return;

      if (reducedMotion) {
        gsap.set(bar, { scaleX: 1, transformOrigin: "left center" });
        return;
      }

      const tween = gsap.fromTo(
        bar,
        { scaleX: 0, transformOrigin: "left center" },
        { scaleX: 1, duration: 0.8, ease: "power2.out" }
      );

      return () => tween.kill();
    },
    { dependencies: [clamped, reducedMotion] }
  );

  return (
    <div
      aria-label={label ?? `Прогресс ${clamped}%`}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={clamped}
      className={className}
      role="progressbar"
    >
      <span className={barClassName} ref={barRef} style={{ width: `${clamped}%`, background: color }} />
    </div>
  );
}
