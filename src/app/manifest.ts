import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GDGoC Sahmyook",
    short_name: "GDGoC SYU",
    description: "삼육대학교 학생 개발자 커뮤니티",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1769e0",
  };
}
