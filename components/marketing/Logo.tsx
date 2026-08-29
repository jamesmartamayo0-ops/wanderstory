"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Plane } from "lucide-react";

export default function Logo({
  className = "",
  overMedia = false,
}: {
  className?: string;
  overMedia?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      className={`flex items-center gap-2.5 ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <motion.div
        className="relative h-9 w-9 shrink-0"
        animate={shouldReduceMotion ? undefined : { scale: isHovered ? 1.08 : 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <motion.div
          className="absolute inset-0 rounded-full bg-[var(--color-sky-400)] opacity-0 blur-md"
          animate={
            shouldReduceMotion ? undefined : { opacity: isHovered ? 0.45 : 0 }
          }
          transition={{ duration: 0.3 }}
        />

        <motion.div
          className="absolute inset-0 rounded-full bg-gradient-to-br from-[var(--color-ocean-600)] to-[var(--color-sky-400)] shadow-[var(--shadow-elevated)]"
          animate={shouldReduceMotion ? undefined : { rotate: 360 }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        >
          <svg viewBox="0 0 36 36" className="h-full w-full opacity-50">
            <ellipse cx="18" cy="18" rx="16" ry="7" fill="none" stroke="white" strokeWidth="0.6" />
            <ellipse cx="18" cy="18" rx="7" ry="16" fill="none" stroke="white" strokeWidth="0.6" />
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="white" strokeWidth="0.6" />
          </svg>
        </motion.div>

        <motion.div
          className="absolute inset-0"
          animate={shouldReduceMotion ? undefined : { rotate: 360 }}
          transition={{
            duration: isHovered ? 1.6 : 6,
            repeat: Infinity,
            ease: "linear",
          }}
        >
          <Plane
            className="absolute -top-1 left-1/2 h-3 w-3 -translate-x-1/2 rotate-90 text-[var(--color-sunset-400)]"
            strokeWidth={2.5}
          />
        </motion.div>
      </motion.div>

      <span
        className={`font-[family-name:var(--font-heading)] text-lg font-semibold tracking-tight transition-colors ${
          overMedia
            ? "text-[var(--color-text-on-media)]"
            : "text-[var(--color-text-primary)]"
        }`}
      >
        WanderStory
      </span>
    </div>
  );
}
