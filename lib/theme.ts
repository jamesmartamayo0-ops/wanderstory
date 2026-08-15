export const THEME_STORAGE_KEY = "wanderstory-theme";

export type ThemePreference = "light" | "dark" | "system";

export const THEME_PREFERENCES: ThemePreference[] = ["light", "dark", "system"];

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function getStoredTheme(): ThemePreference | null {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemePreference(raw)) {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}

export function getSystemTheme(): "light" | "dark" {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

export function resolveEffectiveTheme(
  preference: ThemePreference | null
): "light" | "dark" {
  if (preference === "light" || preference === "dark") {
    return preference;
  }
  return getSystemTheme();
}

export function applyTheme(effective: "light" | "dark") {
  try {
    document.documentElement.dataset.theme = effective;
  } catch {
    // Never throw — theme application must be failure-proof.
  }
}

export function storeTheme(preference: ThemePreference) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage may be unavailable (private mode, disabled cookies) —
    // the in-memory preference still applies for this session.
  }
}