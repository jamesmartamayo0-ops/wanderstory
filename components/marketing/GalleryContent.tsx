"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import GalleryItem from "./GalleryItem";
import type { GalleryItem as GalleryItemType } from "@/data/gallery";

interface GalleryContentProps {
  items: GalleryItemType[];
}

export default function GalleryContent({ items }: GalleryContentProps) {
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
      {items.map((galleryItem) => (
        <motion.div key={galleryItem.id} variants={item}>
          <GalleryItem item={galleryItem} />
        </motion.div>
      ))}
    </motion.div>
  );
}
