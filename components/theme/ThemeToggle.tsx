"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import {
  THEME_PREFERENCES,
  applyTheme,
  getStoredTheme,
  getSystemTheme,
  resolveEffectiveTheme,
  storeTheme,
  type ThemePreference,
} from "@/lib/theme";

const ICONS: Record<ThemePreference, LucideIcon> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const NEXT_ACTION_LABEL: Record<ThemePreference, string> = {
  light: "Switch to dark theme",
  dark: "Switch to system theme",
  system: "Switch to light theme",
};

export default function ThemeToggle({ overMedia = false }: { overMedia?: boolean }) {
  const [preference, setPreference] = useState<ThemePreference>("system");

  useLayoutEffect(() => {
    const stored = getStoredTheme();
    const initial = stored ?? "system";
    setPreference(initial);
    applyTheme(resolveEffectiveTheme(initial));
  }, []);

  useEffect(() => {
    if (preference !== "system") return;

    let mql: MediaQueryList | null = null;
    try {
      mql = window.matchMedia("(prefers-color-scheme: dark)");
      const onChange = () => applyTheme(getSystemTheme());
      mql.addEventListener("change", onChange);
      return () => mql?.removeEventListener("change", onChange);
    } catch {
      return;
    }
  }, [preference]);

  const cycle = () => {
    const next =
      THEME_PREFERENCES[
        (THEME_PREFERENCES.indexOf(preference) + 1) %
          THEME_PREFERENCES.length
      ];
    setPreference(next);
    storeTheme(next);
    applyTheme(resolveEffectiveTheme(next));
  };

  const Icon = ICONS[preference];

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={NEXT_ACTION_LABEL[preference]}
      className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
        overMedia
          ? "text-[var(--color-text-on-media)] hover:bg-white/15 focus-visible:ring-white focus-visible:ring-offset-transparent"
          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-accent)] hover:text-[var(--color-text-link)] focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-offset-[var(--color-surface)]"
      }`}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
