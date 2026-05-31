"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef, type ReactNode } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

type StaggerRevealProps = {
  children: ReactNode;
  className?: string;
  itemSelector?: string;
};

export function StaggerReveal({ children, className, itemSelector = "[data-stagger-item]" }: StaggerRevealProps) {
  const scope = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;

      const items = gsap.utils.toArray<HTMLElement>(root.querySelectorAll(itemSelector));
      if (!items.length) return;

      if (reducedMotion) {
        gsap.set(items, { opacity: 1, y: 0, scale: 1, clearProps: "transform" });
        return;
      }

      gsap.from(items, {
        opacity: 0,
        y: 12,
        scale: 0.98,
        duration: 0.4,
        ease: "power3.out",
        stagger: 0.045
      });
    },
    { scope, dependencies: [reducedMotion, itemSelector] }
  );

  return (
    <div className={className} ref={scope}>
      {children}
    </div>
  );
}
