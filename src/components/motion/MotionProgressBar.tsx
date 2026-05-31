"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

type MotionProgressBarProps = {
  value: number;
  className?: string;
  color?: string;
  label?: string;
};

function clampProgress(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function MotionProgressBar({ value, className = "progress", color, label }: MotionProgressBarProps) {
  const barRef = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);
  const previousValue = useRef(clampProgress(value));
  const reducedMotion = usePrefersReducedMotion();
  const clamped = clampProgress(value);

  useGSAP(
    () => {
      const bar = barRef.current;
      if (!bar) return;

      if (reducedMotion) {
        gsap.set(bar, { width: `${clamped}%` });
        hasAnimated.current = true;
        previousValue.current = clamped;
        return;
      }

      const fromWidth = hasAnimated.current ? `${previousValue.current}%` : "0%";
      hasAnimated.current = true;

      const tween = gsap.fromTo(
        bar,
        { width: fromWidth },
        {
          width: `${clamped}%`,
          duration: 0.55,
          ease: "power3.out",
          onComplete: () => {
            previousValue.current = clamped;
          }
        }
      );

      return () => {
        previousValue.current = clamped;
        tween.kill();
      };
    },
    { dependencies: [clamped, reducedMotion] }
  );

  return (
    <div aria-label={label ?? `Прогресс ${clamped}%`} className={className} role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
      <span ref={barRef} style={{ width: `${clamped}%`, background: color }} />
    </div>
  );
}
