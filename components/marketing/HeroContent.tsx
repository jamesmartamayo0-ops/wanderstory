"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { HeroProps } from "./Hero";

type HeroContentProps = Required<HeroProps>;

export default function HeroContent({
  eyebrow,
  headline,
  subheadline,
  description,
  ctaLabel,
  ctaHref,
  imageSrc,
  imageAlt,
  videoSrc,
}: HeroContentProps) {
  const shouldReduceMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const nav = navigator as Navigator & {
      connection?: { saveData?: boolean };
    };
    if (nav.connection?.saveData === true && videoRef.current) {
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }
  }, []);

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
    <section
      aria-label="Hero"
      className="relative flex min-h-screen items-end overflow-hidden pt-24 pb-20"
    >
      <div className="absolute inset-0">
        <video
          ref={videoRef}
          className="hero-video absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={imageSrc}
          aria-hidden="true"
          tabIndex={-1}
          disablePictureInPicture
        >
          <source src={videoSrc} type="video/mp4" />
        </video>

        <motion.div
          className="relative h-full w-full"
          initial={{ scale: 1 }}
          animate={{ scale: 1.05 }}
          transition={{ duration: shouldReduceMotion ? 0 : 20, ease: "linear" }}
        >
          <Image
            src={imageSrc}
            alt={imageAlt}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </motion.div>

        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-ink-950)]/85 via-[var(--color-ink-950)]/35 to-[var(--color-ink-950)]/10" />
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="visible"
        className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-5 px-6"
      >
        <motion.span
          variants={item}
          className="font-[family-name:var(--font-button)] text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-sunset-400)]"
        >
          {eyebrow}
        </motion.span>

        <motion.h1
          variants={item}
          className="max-w-3xl font-[family-name:var(--font-heading)] text-5xl font-semibold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl"
        >
          {headline}
        </motion.h1>

        <motion.p
          variants={item}
          className="max-w-xl font-[family-name:var(--font-body)] text-lg text-white/80 sm:text-xl"
        >
          {subheadline}
        </motion.p>

        <motion.p
          variants={item}
          className="max-w-lg font-[family-name:var(--font-body)] text-sm text-white/60 sm:text-base"
        >
          {description}
        </motion.p>

        <motion.div variants={item} className="mt-2">
          <Link
            href={ctaHref}
            className="group inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--color-ocean-600)] px-7 py-3.5 font-[family-name:var(--font-button)] text-sm font-medium text-white shadow-[var(--shadow-elevated)] transition-all duration-300 hover:scale-[1.03] hover:shadow-[0_12px_40px_rgba(37,99,235,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-ink-950)]"
          >
            {ctaLabel}
            <ArrowRight
              className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
              aria-hidden="true"
            />
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}