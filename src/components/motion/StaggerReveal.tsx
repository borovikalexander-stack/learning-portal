"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef, type ReactNode } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

type StaggerRevealProps = {
  children: ReactNode;
  className?: string;
  itemSelector?: string;
  maxAnimatedItems?: number;
};

export function StaggerReveal({
  children,
  className,
  itemSelector = "[data-stagger-item]",
  maxAnimatedItems = 80
}: StaggerRevealProps) {
  const scope = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;

      const items = gsap.utils.toArray<HTMLElement>(root.querySelectorAll(itemSelector));
      if (!items.length) return;

      if (reducedMotion || items.length > maxAnimatedItems) {
        gsap.set(items, { opacity: 1, clearProps: "transform" });
        return;
      }

      gsap.from(items, {
        opacity: 0,
        duration: 0.35,
        ease: "power1.out",
        stagger: 0.04,
        clearProps: "opacity"
      });
    },
    { scope, dependencies: [reducedMotion, itemSelector, maxAnimatedItems] }
  );

  return (
    <div className={className} ref={scope}>
      {children}
    </div>
  );
}
