"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

type IndexDestination = {
  name: string;
  slug: string;
  continent: string | null;
  featuredPlace: string | null;
};

const QUERY_MAX_LENGTH = 60;

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function matches(query: string, destination: IndexDestination): boolean {
  const q = normalize(query);
  if (!q) return false;
  return (
    normalize(destination.name).includes(q) ||
    normalize(destination.continent ?? "").includes(q) ||
    normalize(destination.featuredPlace ?? "").includes(q)
  );
}

interface DestinationSearchProps {
  initialQuery?: string;
}

export default function DestinationSearch({
  initialQuery = "",
}: DestinationSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery.slice(0, QUERY_MAX_LENGTH));
  const [index, setIndex] = useState<IndexDestination[] | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [hasFetched, setHasFetched] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const loadIndex = useCallback(async () => {
    if (hasFetched) return;
    setHasFetched(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/destinations/search-index", {
        signal: controller.signal,
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        destinations: IndexDestination[];
      };
      setIndex(data.destinations);
    } catch {
      setIndex([]);
    }
  }, [hasFetched]);

  useEffect(() => {
    if (initialQuery) {
      loadIndex();
    }
  }, [initialQuery, loadIndex]);

  const results =
    index?.filter((destination) => matches(query, destination)) ?? [];
  const hasQuery = query.trim().length > 0;

  useEffect(() => {
    setActiveIndex(-1);
  }, [query]);

  const syncQueryParam = useCallback(
    (value: string) => {
      const params = new URLSearchParams(window.location.search);
      const next = value.slice(0, QUERY_MAX_LENGTH).trim();
      if (next) {
        params.set("q", next);
      } else {
        params.delete("q");
      }
      const queryString = params.toString();
      router.replace(queryString ? `/destinations?${queryString}` : "/destinations", {
        scroll: false,
      });
    },
    [router]
  );

  const handleInputChange = (value: string) => {
    const next = value.slice(0, QUERY_MAX_LENGTH);
    setQuery(next);
    syncQueryParam(next);
    if (!hasFetched) {
      loadIndex();
    }
  };

  const handleFocus = () => {
    setIsOpen(true);
    if (!hasFetched) {
      loadIndex();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!hasQuery || results.length === 0) {
      if (event.key === "Escape") {
        setIsOpen(false);
        event.currentTarget.blur();
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        if (activeIndex >= 0 && results[activeIndex]) {
          event.preventDefault();
          router.push(`/destinations/${results[activeIndex].slug}`);
          setIsOpen(false);
          inputRef.current?.blur();
        }
        break;
      case "Escape":
        event.preventDefault();
        setIsOpen(false);
        setActiveIndex(-1);
        event.currentTarget.blur();
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    const active = listboxRef.current?.querySelector<HTMLElement>(
      `[data-index="${activeIndex}"]`
    );
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  return (
    <div className="relative">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-neutral-400"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={isOpen && hasQuery && results.length > 0}
          aria-controls="destination-search-listbox"
          aria-activedescendant={
            activeIndex >= 0 ? `destination-search-option-${activeIndex}` : undefined
          }
          aria-label="Search destinations"
          placeholder="Search destinations, countries, places…"
          maxLength={QUERY_MAX_LENGTH}
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => handleInputChange(event.target.value)}
          onFocus={handleFocus}
          onBlur={() => {
            setTimeout(() => setIsOpen(false), 120);
          }}
          onKeyDown={handleKeyDown}
          className="w-full rounded-[var(--radius-pill)] border border-neutral-200 bg-[var(--color-surface)] py-3 pr-11 pl-12 font-[family-name:var(--font-body)] text-sm text-[var(--color-ink-950)] shadow-[var(--shadow-elevated)] transition-colors placeholder:text-neutral-400 focus:border-[var(--color-ocean-600)] focus:ring-2 focus:ring-[var(--color-ocean-600)]/30 focus:outline-none"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              handleInputChange("");
              inputRef.current?.focus();
            }}
            className="absolute top-1/2 right-3 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {isOpen && hasQuery && (
        <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-neutral-200 bg-[var(--color-surface)] shadow-[var(--shadow-elevated)]">
          {results.length === 0 ? (
            <p className="px-5 py-4 text-sm text-neutral-500" role="status">
              No destinations match &ldquo;{query}&rdquo;.
            </p>
          ) : (
            <>
              <p
                className="px-5 pt-3 text-xs text-neutral-400"
                role="status"
                aria-live="polite"
              >
                {results.length} {results.length === 1 ? "result" : "results"}
              </p>
              <ul
                ref={listboxRef}
                id="destination-search-listbox"
                role="listbox"
                aria-label="Destination results"
                className="max-h-72 overflow-y-auto py-1"
              >
                {results.map((destination, index) => (
                  <li
                    key={destination.slug}
                    role="option"
                    id={`destination-search-option-${index}`}
                    data-index={index}
                    aria-selected={index === activeIndex}
                    className="px-2"
                  >
                    <Link
                      href={`/destinations/${destination.slug}`}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setIsOpen(false);
                        inputRef.current?.blur();
                      }}
                      className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                        index === activeIndex
                          ? "bg-[var(--color-ocean-600)]/10"
                          : ""
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-[family-name:var(--font-body)] text-sm font-medium text-[var(--color-ink-950)]">
                          {destination.name}
                        </span>
                        {destination.featuredPlace && (
                          <span className="block truncate text-xs text-neutral-500">
                            {destination.featuredPlace}
                          </span>
                        )}
                      </span>
                      {destination.continent && (
                        <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-neutral-500 uppercase">
                          {destination.continent.replace(/-/g, " ")}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}