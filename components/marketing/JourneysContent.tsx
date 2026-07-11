"use client";

import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import JourneyCard from "./JourneyCard";
import type { PublicJourney } from "@/lib/adapters/journey.adapter";

interface JourneysContentProps {
  journeys: PublicJourney[];
}

export default function JourneysContent({ journeys }: JourneysContentProps) {
  const shouldReduceMotion = useReducedMotion();

  const container: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.12,
        delayChildren: shouldReduceMotion ? 0 : 0.15,
      },
    },
  };

  const item: Variants = {
    hidden: { opacity: 0, y: 48 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.6,
        ease: [0.22, 1, 0.36, 1],
      },
    },
  };

  if (journeys.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="font-[family-name:var(--font-body)] text-neutral-400">
          No journeys published yet. Check back soon.
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
      {journeys.map((journey) => (
        <motion.div key={journey.id} variants={item}>
          <Link
            href={`/journeys/${journey.slug}`}
            className="block"
          >
            <JourneyCard journey={journey} />
          </Link>
        </motion.div>
      ))}
    </motion.div>
  );
}
