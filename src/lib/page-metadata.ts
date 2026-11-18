import type { Metadata } from "next";

export const chapterOpenGraph = {
  type: "website",
  locale: "ko_KR",
  siteName: "GDGOC Sahmyook",
  images: [{ url: "/brand/gdgoc-symbol-transparent.png", width: 1254, height: 1254, alt: "GDGOC Sahmyook 심벌" }],
} satisfies Metadata["openGraph"];

export function pageMetadata(title: string, description: string, url: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { ...chapterOpenGraph, title: `${title} | GDGOC Sahmyook`, description, url },
  };
}
