const SENSITIVE_KEY_PATTERN =
  /pass(word|phrase)?|token|cookie|secret|authorization|credential|bearer|api[_-]?key/i;

const MAX_METADATA_BYTES = 4096;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeIpAddress(ip: string | null | undefined): string | null {
  if (!ip) return null;
  let normalized = ip.trim().toLowerCase();
  if (normalized.startsWith("::ffff:")) {
    normalized = normalized.slice(7);
  }
  const zoneIndex = normalized.indexOf("%");
  if (zoneIndex !== -1) {
    normalized = normalized.slice(0, zoneIndex);
  }
  return normalized === "" ? null : normalized;
}

type HeaderProvider = {
  get(name: string): string | null | undefined;
};

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key);
}

function walk(value: unknown, depth: number): unknown {
  if (depth > 6) return null;
  if (Array.isArray(value)) {
    return value.map((item) => walk(item, depth + 1));
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(key)) continue;
      const cleaned = walk(item, depth + 1);
      if (cleaned !== undefined) result[key] = cleaned;
    }
    return result;
  }
  return value;
}

export function sanitizeMetadata(
  value: unknown,
): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  const cleaned = walk(value, 0);
  if (cleaned === null || typeof cleaned !== "object" || Array.isArray(cleaned)) {
    return null;
  }
    let json = JSON.stringify(cleaned);
    if (json.length > MAX_METADATA_BYTES) {
      const truncated: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(cleaned as Record<string, unknown>)) {
        truncated[key] = item;
        json = JSON.stringify(truncated);
        if (json.length > MAX_METADATA_BYTES) {
          delete truncated[key];
        }
      }
      return truncated;
    }
  return cleaned as Record<string, unknown>;
}

export function getTrustedClientIp(
  headers: HeaderProvider,
  options?: { trustProxy?: boolean },
): string | null {
  const trustProxy =
    options?.trustProxy ?? process.env.TRUST_PROXY === "1";
  if (!trustProxy) return null;

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0];
    return normalizeIpAddress(first);
  }
  return normalizeIpAddress(headers.get("x-real-ip"));
}

export function buildRateLimitKey(
  feature: string,
  identifierType: string,
  identifier: string,
): string {
  return `${feature}:${identifierType}:${identifier}`;
}

export function loginEmailKey(email: string): string {
  return buildRateLimitKey("login", "email", normalizeEmail(email));
}

export function loginIpKey(ip: string | null | undefined): string | null {
  const normalized = normalizeIpAddress(ip);
  return normalized ? buildRateLimitKey("login", "ip", normalized) : null;
}

export function actionKey(adminId: string): string {
  return buildRateLimitKey("action", "admin", adminId);
}
