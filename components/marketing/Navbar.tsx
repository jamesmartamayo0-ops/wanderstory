"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import Logo from "./Logo";
import MobileMenu from "./MobileMenu";
import ThemeToggle from "../theme/ThemeToggle";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Destinations", href: "/destinations" },
  { label: "Journeys", href: "/journeys" },
  { label: "Stories", href: "/stories" },
  { label: "Gallery", href: "/gallery" },
  { label: "Saved", href: "/saved" },
  { label: "About", href: "/about" },
];

export default function Navbar({ overMedia = false }: { overMedia?: boolean }) {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isOnMedia = overMedia && !isScrolled;

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 40);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <header
        className={`pointer-events-none fixed inset-x-0 top-0 z-50 transition-all duration-300 motion-reduce:transition-none ${
          isScrolled ? "py-3" : "py-5"
        }`}
      >
        <div
          className={`pointer-events-auto mx-auto flex max-w-6xl items-center justify-between rounded-[var(--radius-pill)] px-6 py-2.5 transition-all duration-300 motion-reduce:transition-none ${
            isScrolled || !overMedia
              ? "border border-[var(--color-border)]/80 bg-[var(--color-surface)]/85 shadow-[var(--shadow-elevated)] backdrop-blur-xl"
              : "border border-transparent bg-transparent"
          }`}
        >
          <Link
            href="/"
            aria-label="WanderStory home"
            className={`rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
              isOnMedia
                ? "focus-visible:ring-white"
                : "focus-visible:ring-[var(--color-focus-ring)]"
            }`}
          >
            <Logo overMedia={isOnMedia} />
          </Link>

          <nav className="hidden items-center gap-7 lg:flex">
            {NAV_LINKS.map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname === link.href || pathname.startsWith(`${link.href}/`);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-md px-1 py-2 font-[family-name:var(--font-body)] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                    isOnMedia
                      ? `text-[var(--color-text-on-media)] hover:text-white focus-visible:ring-white focus-visible:ring-offset-transparent ${active ? "underline decoration-2 underline-offset-8" : ""}`
                      : `hover:text-[var(--color-text-link)] focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-[var(--color-surface)] ${active ? "text-[var(--color-text-link)]" : "text-[var(--color-text-secondary)]"}`
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-4 lg:flex">
            <Link
              href="/#explore"
              className="rounded-[var(--radius-pill)] bg-[var(--color-interactive)] px-5 py-2.5 font-[family-name:var(--font-button)] text-sm font-medium text-[var(--color-text-on-media)] transition hover:scale-[1.03] hover:bg-[var(--color-interactive-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent motion-reduce:transform-none motion-reduce:transition-none"
            >
              Start Exploring
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle overMedia={isOnMedia} />
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={isMobileMenuOpen}
              className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 lg:hidden ${
                isOnMedia
                  ? "text-[var(--color-text-on-media)] hover:bg-white/15 focus-visible:ring-white focus-visible:ring-offset-transparent"
                  : "text-[var(--color-text-primary)] hover:bg-[var(--color-surface-accent)] focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-[var(--color-surface)]"
              }`}
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>

      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        links={NAV_LINKS}
      />
    </>
  );
}
