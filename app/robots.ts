import type { MetadataRoute } from "next";

// Private family site: ask all crawlers not to index anything.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
