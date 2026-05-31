"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { CheckCircle2 } from "lucide-react";
import { useRef } from "react";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

type ScoreRingProps = {
  percent: number | null;
  passed: boolean;
  pending: boolean;
};

const radius = 52;
const circumference = 2 * Math.PI * radius;

function clampPercent(value: number | null) {
  if (value === null) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function ScoreRing({ percent, passed, pending }: ScoreRingProps) {
  const valueRef = useRef<SVGCircleElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const clamped = clampPercent(percent);
  const dashOffset = circumference * (1 - clamped / 100);
  const color = passed ? "var(--success)" : pending ? "var(--warning)" : "var(--danger)";

  useGSAP(
    () => {
      const ring = valueRef.current;
      if (!ring) return;

      if (reducedMotion) {
        gsap.set(ring, { strokeDashoffset: dashOffset });
        return;
      }

      const timeline = gsap.timeline();
      timeline.fromTo(
        ring,
        { strokeDashoffset: circumference },
        { strokeDashoffset: dashOffset, duration: 0.9, ease: "power2.out" }
      );

      if (passed && centerRef.current) {
        timeline.to(centerRef.current, { scale: 1.08, duration: 0.16, ease: "back.out(1.6)" }, "-=0.05");
        timeline.to(centerRef.current, { scale: 1, duration: 0.14, ease: "power1.out" });
      }

      return () => timeline.kill();
    },
    { dependencies: [dashOffset, passed, reducedMotion] }
  );

  return (
    <div className="score-ring" aria-label={percent === null ? "Результат ожидает проверки" : `Результат ${clamped}%`}>
      <svg aria-hidden viewBox="0 0 120 120">
        <circle className="score-ring-track" cx="60" cy="60" r={radius} />
        <circle
          className="score-ring-value"
          cx="60"
          cy="60"
          r={radius}
          ref={valueRef}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="score-ring-label" ref={centerRef}>
        {pending || percent === null ? (
          <span>—</span>
        ) : passed ? (
          <span className="score-ring-passed">
            <CheckCircle2 size={22} />
            <AnimatedNumber suffix="%" value={clamped} />
          </span>
        ) : (
          <AnimatedNumber suffix="%" value={clamped} />
        )}
      </div>
    </div>
  );
}
