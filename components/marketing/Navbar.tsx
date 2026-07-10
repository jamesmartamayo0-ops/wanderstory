"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import Logo from "./Logo";
import MobileMenu from "./MobileMenu";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Destinations", href: "/destinations" },
  { label: "Journeys", href: "/journeys" },
  { label: "Stories", href: "/stories" },
  { label: "Gallery", href: "/gallery" },
  { label: "About", href: "/about" },
];

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 40);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          isScrolled ? "py-3" : "py-5"
        }`}
      >
        <div
          className={`mx-auto flex max-w-6xl items-center justify-between rounded-[var(--radius-pill)] px-6 py-2.5 transition-all duration-300 ${
            isScrolled
              ? "border border-white/40 bg-white/70 shadow-[var(--shadow-elevated)] backdrop-blur-xl"
              : "border border-transparent bg-transparent"
          }`}
        >
          <Link href="/" aria-label="WanderStory home">
            <Logo />
          </Link>

          <nav className="hidden items-center gap-7 lg:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-[family-name:var(--font-body)] text-sm font-medium text-neutral-700 transition-colors hover:text-[var(--color-ocean-600)]"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-4 lg:flex">
            <Link
              href="/admin/login"
              className="font-[family-name:var(--font-body)] text-sm font-medium text-neutral-700 transition-colors hover:text-[var(--color-ocean-600)]"
            >
              Login
            </Link>
            <Link
              href="#explore"
              className="rounded-[var(--radius-pill)] bg-[var(--color-ocean-600)] px-5 py-2.5 font-[family-name:var(--font-button)] text-sm font-medium text-white transition-transform hover:scale-[1.03]"
            >
              Start Exploring
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={isMobileMenuOpen}
            className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-900 lg:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>
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