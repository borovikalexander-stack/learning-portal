"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef, type ReactNode } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

gsap.registerPlugin(ScrollTrigger);

type ScrollRevealProps = {
  children: ReactNode;
  className?: string;
};

export function ScrollReveal({ children, className }: ScrollRevealProps) {
  const scope = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;

      const items = gsap.utils.toArray<HTMLElement>(root.querySelectorAll("[data-scroll-reveal]"));
      if (!items.length) return;

      if (reducedMotion) {
        gsap.set(items, { opacity: 1, clearProps: "all" });
        return;
      }

      items.forEach((item) => {
        gsap.from(item, {
          opacity: 0,
          y: 16,
          duration: 0.5,
          ease: "power2.out",
          clearProps: "opacity,transform",
          scrollTrigger: {
            trigger: item,
            start: "top 85%",
            once: true
          }
        });
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
