"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";

interface HeroAnimationWrapperProps {
  title: string;
  travelerName: string;
  destinationName: string;
  destinationCountry: string;
  location: string | null;
  startDate: string;
  endDate: string;
  categories: Array<{ name: string; slug: string }>;
}

export default function HeroAnimationWrapper({
  title,
  travelerName,
  destinationName,
  destinationCountry,
  location,
  startDate,
  endDate,
  categories,
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
      <motion.div variants={item} className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <span
            key={cat.slug}
            className="rounded-[var(--radius-pill)] bg-white/20 px-3 py-1 font-[family-name:var(--font-button)] text-xs font-semibold uppercase tracking-wider text-[var(--color-text-on-media)] backdrop-blur-sm"
          >
            {cat.name}
          </span>
        ))}
      </motion.div>

      <motion.h1
        variants={item}
        className="max-w-4xl font-[family-name:var(--font-heading)] text-4xl font-semibold leading-[1.1] tracking-tight text-[var(--color-text-on-media)] sm:text-5xl lg:text-6xl"
      >
        {title}
      </motion.h1>

      {location && (
        <motion.p
          variants={item}
          className="font-[family-name:var(--font-button)] text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-sunset-400)]"
        >
          {location}
        </motion.p>
      )}

      <motion.p
        variants={item}
        className="font-[family-name:var(--font-body)] text-lg text-[var(--color-text-on-media)]/85 sm:text-xl"
      >
        by {travelerName}
      </motion.p>

      <motion.p
        variants={item}
        className="font-[family-name:var(--font-body)] text-base text-[var(--color-media-caption)]"
      >
        {location ? destinationCountry : `${destinationName}, ${destinationCountry}`}
      </motion.p>

      <motion.p
        variants={item}
        className="font-[family-name:var(--font-body)] text-sm text-[var(--color-media-caption)]/80"
      >
        {startDate} — {endDate}
      </motion.p>
    </motion.div>
  );
}
