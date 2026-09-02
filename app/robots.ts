import type { MetadataRoute } from "next";
import { resolveSiteOrigin } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = resolveSiteOrigin().origin;

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: "/admin/",
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
