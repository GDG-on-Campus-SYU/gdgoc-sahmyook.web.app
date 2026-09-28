import Link from "next/link";
import Image from "next/image";
import { MobileNav } from "@/components/mobile-nav";
import { DesktopNav } from "@/components/desktop-nav";
import { TrackedLink } from "@/components/tracked-link";

const navigation = [
  ["About", "/about"],
  ["Activities", "/activities"],
  ["Projects", "/projects"],
  ["People", "/people"],
  ["Recruit", "/recruit"],
] as const;

const logos = {
  chapterHorizontal: {
    src: "/brand/gdgoc-sahmyook-horizontal-trimmed.png",
    className: "logo-chapter-horizontal",
    width: 1076,
    height: 164,
    alt: "Google Developer Group On Campus, Sahmyook University",
  },
  gdgocHorizontal: {
    src: "/brand/gdgoc-on-campus-horizontal-trimmed.png",
    className: "logo-gdgoc-horizontal",
    width: 1800,
    height: 130,
    alt: "Google Developer Group on Campus",
  },
  chapterStacked: {
    src: "/brand/gdgoc-sahmyook-stacked-trimmed.png",
    className: "logo-chapter-stacked",
    width: 802,
    height: 398,
    alt: "Google Developer Group On Campus, Sahmyook University",
  },
} as const;

export function BrandLogo({ variant = "chapterHorizontal", priority = false }: { variant?: keyof typeof logos; priority?: boolean }) {
  const logo = logos[variant];
  return (
    <span className={`logo-crop ${logo.className}`}>
      <Image className="logo-source" src={logo.src} width={logo.width} height={logo.height} alt={logo.alt} priority={priority} />
    </span>
  );
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container nav-shell">
        <Link href="/" className="brand-link">
          <BrandLogo priority />
        </Link>
        <DesktopNav items={navigation} />
        <MobileNav items={navigation} />
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <div className="footer-brand-panel"><BrandLogo variant="chapterStacked" /></div>
          <p>삼육대학교에서 함께 배우고, 만들고, 경험을 나누는 학생 개발자 커뮤니티.</p>
        </div>
        <div className="footer-links">
          <strong>Explore</strong>
          {navigation.map(([label, href]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </div>
        <div className="footer-links">
          <strong>Community</strong>
          <TrackedLink href="https://gdg.community.dev/gdg-on-campus-sahmyook-university-seoul-south-korea/" event="chapter_visit_click" external>공식 챕터 페이지 ↗</TrackedLink>
          <TrackedLink href="https://github.com/orgs/GDG-on-Campus-SYU/" event="github_click" external>GitHub ↗</TrackedLink>
          <TrackedLink href="mailto:dscsahmyook@gmail.com" event="contact_click">문의 이메일 ↗</TrackedLink>
          <a href="https://developers.google.com/community" target="_blank" rel="noopener noreferrer">
            GDG on Campus <span aria-hidden="true">↗</span>
          </a>
          <a href="https://gdg.community.dev/participation-terms/" target="_blank" rel="noopener noreferrer">행사 참여 기준 ↗</a>
          <Link href="/privacy/">방문 분석 안내·설정</Link>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} GDGoC Sahmyook</span>
        <span>이 챕터는 독립적으로 운영되며, 게시된 견해는 Google의 견해를 대변하지 않습니다.</span>
      </div>
    </footer>
  );
}

export function PageHero({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <section className="page-hero container">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="page-lede">{description}</p>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action && (
        <Link href={action.href} className="text-link">
          {action.label} <span aria-hidden="true">→</span>
        </Link>
      )}
    </div>
  );
}
