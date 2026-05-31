"use client";

import { AnimatedBar } from "@/components/motion/AnimatedBar";

type MotionProgressBarProps = {
  value: number;
  className?: string;
  color?: string;
  label?: string;
};

export function MotionProgressBar(props: MotionProgressBarProps) {
  return <AnimatedBar {...props} />;
}
