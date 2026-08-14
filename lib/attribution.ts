const PERMISSIVE_PATTERNS = [
  /^cc0/i,
  /^public domain/i,
  /no rights reserved/i,
  /^pd[- ]/i,
];

const ATTRIBUTION_PATTERNS = [
  /^cc by/i,
  /^gfdl/i,
  /^odbl/i,
  /^falc/i,
];

export function licenseRequiresAttribution(licenseName: string): boolean {
  const normalized = licenseName.trim();
  if (!normalized) return true;

  if (PERMISSIVE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return false;
  }

  if (ATTRIBUTION_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  return true;
}

export function formatPhotoCredit(
  author: string,
  licenseName: string
): string {
  return `Photo: ${author} · ${licenseName}`;
}