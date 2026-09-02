export class SiteOriginConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SiteOriginConfigurationError";
  }
}

export interface SiteOriginEnvironment {
  NEXT_PUBLIC_SITE_URL?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  VERCEL?: string;
}

function isLoopbackHostname(hostname: string): boolean {
  const normalizedHostname = hostname.replace(/^\[|\]$/g, "").toLowerCase();

  return (
    normalizedHostname === "localhost" ||
    normalizedHostname === "::1" ||
    /^127(?:\.\d{1,3}){3}$/.test(normalizedHostname)
  );
}

function validateOrigin(
  candidate: string,
  options: { allowLoopback: boolean },
): URL | null {
  try {
    if (!/^https?:\/\//i.test(candidate)) return null;
    if (candidate.includes("?") || candidate.includes("#")) return null;

    const url = new URL(candidate);

    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    if (url.pathname !== "/" || url.search || url.hash) return null;
    const isLoopback = isLoopbackHostname(url.hostname);
    if (isLoopback && !options.allowLoopback) return null;
    if (url.protocol !== "https:" && !isLoopback) {
      return null;
    }

    return new URL(url.origin);
  } catch {
    return null;
  }
}

function productionHostnameOrigin(hostname: string | undefined): URL | null {
  const normalizedHostname = hostname?.trim();

  if (!normalizedHostname || normalizedHostname.includes("://")) return null;

  return validateOrigin(`https://${normalizedHostname}`, {
    allowLoopback: false,
  });
}

export function resolveSiteOrigin(
  environment: SiteOriginEnvironment = {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    VERCEL_PROJECT_PRODUCTION_URL:
      process.env.VERCEL_PROJECT_PRODUCTION_URL,
    VERCEL: process.env.VERCEL,
  },
): URL {
  const configuredOrigin = environment.NEXT_PUBLIC_SITE_URL?.trim();
  const validatedConfiguredOrigin = configuredOrigin
    ? validateOrigin(configuredOrigin, {
        allowLoopback: !environment.VERCEL,
      })
    : null;

  if (validatedConfiguredOrigin) return validatedConfiguredOrigin;

  const vercelProductionOrigin = productionHostnameOrigin(
    environment.VERCEL_PROJECT_PRODUCTION_URL,
  );

  if (vercelProductionOrigin) return vercelProductionOrigin;

  if (environment.VERCEL) {
    throw new SiteOriginConfigurationError(
      "A valid NEXT_PUBLIC_SITE_URL or VERCEL_PROJECT_PRODUCTION_URL is required on Vercel.",
    );
  }

  return new URL("http://localhost:3000");
}

export function buildPublicJourneyUrl(
  slug: string,
  siteOrigin: URL = resolveSiteOrigin(),
): URL {
  return new URL(`/journeys/${encodeURIComponent(slug)}`, siteOrigin);
}
