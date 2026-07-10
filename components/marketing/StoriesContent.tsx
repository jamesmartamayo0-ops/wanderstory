"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import StoryCard from "./StoryCard";
import type { StoryItem } from "@/data/stories";

interface StoriesContentProps {
  stories: StoryItem[];
}

export default function StoriesContent({ stories }: StoriesContentProps) {
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
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.5,
        ease: [0.22, 1, 0.36, 1],
      },
    },
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      className="flex flex-col gap-6"
    >
      {stories.map((story) => (
        <motion.div key={story.id} variants={item}>
          <StoryCard story={story} />
        </motion.div>
      ))}
    </motion.div>
  );
}
