"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

type AnimatedNumberProps = {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
};

export function AnimatedNumber({ value, prefix = "", suffix = "", className }: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const reducedMotion = usePrefersReducedMotion();
  const previousValue = useRef(value);

  useGSAP(
    () => {
      if (reducedMotion) {
        setDisplayValue(value);
        previousValue.current = value;
        return;
      }

      const state = { value: previousValue.current };
      const tween = gsap.to(state, {
        value,
        duration: 0.55,
        ease: "power2.out",
        onUpdate: () => setDisplayValue(Math.round(state.value)),
        onComplete: () => {
          previousValue.current = value;
          setDisplayValue(value);
        }
      });

      return () => tween.kill();
    },
    { dependencies: [value, reducedMotion] }
  );

  return <strong className={className}>{prefix}{displayValue}{suffix}</strong>;
}
