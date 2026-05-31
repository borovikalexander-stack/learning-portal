"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef, type ReactNode } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

type PageRevealProps = {
  children: ReactNode;
  className?: string;
};

export function PageReveal({ children, className }: PageRevealProps) {
  const scope = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;

      const items = gsap.utils.toArray<HTMLElement>(root.querySelectorAll("[data-reveal]"));
      const targets = items.length ? items : [root];

      if (reducedMotion) {
        gsap.set(targets, { opacity: 1, clearProps: "transform" });
        return;
      }

      gsap.from(targets, {
        opacity: 0,
        duration: 0.35,
        ease: "power1.out",
        stagger: 0.05,
        clearProps: "opacity"
      });
    },
    { scope, dependencies: [reducedMotion] }
  );

  return (
    <div className={className} ref={scope}>
      {children}
    </div>
  );
}
