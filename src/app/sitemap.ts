import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://gdgoc-sahmyook.web.app");
  return ["", "/about", "/activities", "/projects", "/people", "/recruit", "/privacy"].map((path) => ({ url: new URL(path || "/", base).href, changeFrequency: "monthly" as const, priority: path ? 0.8 : 1 }));
}
