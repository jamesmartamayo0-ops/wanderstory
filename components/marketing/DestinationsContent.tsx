"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import DestinationDirectoryCard from "./DestinationDirectoryCard";
import type { DestinationCardView } from "@/lib/adapters/destination.adapter";

const STAGGER_CAP_COUNT = 12;
const STAGGER_STEP_SECONDS = 0.06;

interface DestinationsContentProps {
  destinations: DestinationCardView[];
  featureFirst?: boolean;
}

export default function DestinationsContent({
  destinations,
  featureFirst = false,
}: DestinationsContentProps) {
  const shouldReduceMotion = useReducedMotion();

  const container: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0,
        delayChildren: shouldReduceMotion ? 0 : 0.1,
      },
    },
  };

  const item: Variants = {
    hidden: { opacity: 0, y: 48 },
    visible: (delayIndex: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.6,
        delay: shouldReduceMotion
          ? 0
          : delayIndex < STAGGER_CAP_COUNT
            ? delayIndex * STAGGER_STEP_SECONDS
            : 0,
        ease: [0.22, 1, 0.36, 1],
      },
    }),
  };

  if (destinations.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="font-[family-name:var(--font-body)] text-neutral-400">
          No destinations available yet. Check back soon.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
      className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
    >
      {destinations.map((dest, index) => (
        <motion.div
          key={dest.id}
          variants={item}
          custom={index}
          className={
            featureFirst && index === 0 ? "sm:col-span-2 lg:col-span-2" : ""
          }
        >
          <DestinationDirectoryCard
            destination={dest}
            variant={featureFirst && index === 0 ? "feature" : "default"}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}