"use client";

import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import DestinationDirectoryCard from "./DestinationDirectoryCard";
import type { DestinationCardView } from "@/lib/adapters/destination.adapter";

interface DestinationsContentProps {
  destinations: DestinationCardView[];
}

export default function DestinationsContent({
  destinations,
}: DestinationsContentProps) {
  const shouldReduceMotion = useReducedMotion();

  const container: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.08,
        delayChildren: shouldReduceMotion ? 0 : 0.1,
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
      {destinations.map((dest) => (
        <motion.div key={dest.id} variants={item}>
          <Link href={`/destinations/${dest.slug}`} className="block">
            <DestinationDirectoryCard destination={dest} />
          </Link>
        </motion.div>
      ))}
    </motion.div>
  );
}