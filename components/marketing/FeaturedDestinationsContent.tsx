"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import DestinationCard from "./DestinationCard";
import type { FeaturedDestination } from "@/data/featured-destinations";

interface FeaturedDestinationsContentProps {
  destinations: FeaturedDestination[];
}

export default function FeaturedDestinationsContent({
  destinations,
}: FeaturedDestinationsContentProps) {
  const shouldReduceMotion = useReducedMotion();

  const container: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.1,
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
          <DestinationCard destination={dest} />
        </motion.div>
      ))}
    </motion.div>
  );
}
