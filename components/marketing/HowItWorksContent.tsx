"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import StepCard from "./StepCard";
import type { HowItWorksStep } from "@/data/how-it-works";

interface HowItWorksContentProps {
  steps: HowItWorksStep[];
}

const circleColors = [
  "var(--color-ocean-600)",
  "var(--color-forest-600)",
  "var(--color-sunset-400)",
];

export default function HowItWorksContent({
  steps,
}: HowItWorksContentProps) {
  const shouldReduceMotion = useReducedMotion();

  const container: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.15,
        delayChildren: shouldReduceMotion ? 0 : 0.2,
      },
    },
  };

  const item: Variants = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.6,
        ease: [0.22, 1, 0.36, 1],
      },
    },
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
      className="grid gap-10 md:grid-cols-3"
    >
      {steps.map((step, index) => (
        <motion.div key={step.id} variants={item}>
          <StepCard
            step={step}
            circleColor={circleColors[index % circleColors.length]}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}
