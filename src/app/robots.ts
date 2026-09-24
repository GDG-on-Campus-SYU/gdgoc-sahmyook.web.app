import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  const base = new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://gdgoc-sahmyook.web.app");
  return { rules: [{ userAgent: "*", allow: "/", disallow: "/admin/" }], sitemap: new URL("/sitemap.xml", base).href };
}
