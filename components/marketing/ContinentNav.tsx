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
              className={`inline-block rounded-full px-4 py-2 font-[family-name:var(--font-button)] text-sm font-semibold transition-colors ${
                isActive(link.slug)
                  ? "bg-[var(--color-ocean-600)] text-white"
                  : "bg-[var(--color-surface)] text-neutral-600 hover:bg-[var(--color-ocean-100)] hover:text-[var(--color-ocean-800)]"
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
