"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";

interface HeroAnimationWrapperProps {
  name: string;
  country: string;
  region: string | null;
}

export default function HeroAnimationWrapper({
  name,
  country,
  region,
}: HeroAnimationWrapperProps) {
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
        duration: shouldReduceMotion ? 0 : 0.7,
        ease: [0.22, 1, 0.36, 1],
      },
    },
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="visible"
      className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-4 px-6"
    >
      <motion.p
        variants={item}
        className="font-[family-name:var(--font-button)] text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-sunset-400)]"
      >
        {region ? `${region}, ${country}` : country}
      </motion.p>

      <motion.h1
        variants={item}
        className="max-w-4xl font-[family-name:var(--font-heading)] text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl"
      >
        {name}
      </motion.h1>
    </motion.div>
  );
}
