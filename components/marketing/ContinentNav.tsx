import Link from "next/link";
import { CONTINENTS } from "@/data/continents";

interface ContinentNavProps {
  activeSlug?: string | null;
}

export default function ContinentNav({ activeSlug }: ContinentNavProps) {
  const links = [
    { slug: null, label: "All Countries", href: "/destinations" },
    ...CONTINENTS.map((continent) => ({
      slug: continent.slug,
      label: continent.name,
      href: `/destinations/continent/${continent.slug}`,
    })),
  ];

  const isActive = (slug: string | null) =>
    activeSlug === undefined ? slug === null : activeSlug === slug;

  return (
    <nav aria-label="Browse by continent">
      <ul className="flex flex-wrap justify-center gap-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={isActive(link.slug) ? "page" : undefined}
              className={`inline-block rounded-full px-4 py-2 font-[family-name:var(--font-button)] text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-alt)] ${
                isActive(link.slug)
                  ? "bg-[var(--color-interactive)] text-[var(--color-text-on-media)]"
                  : "border border-[var(--color-border)] bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-accent)] hover:text-[var(--color-text-link)]"
              }`}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
