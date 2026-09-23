import Link from "next/link";
import Image from "next/image";
import { MobileNav } from "@/components/mobile-nav";

const navigation = [
  ["About", "/about"],
  ["Activities", "/activities"],
  ["Projects", "/projects"],
  ["People", "/people"],
  ["Recruit", "/recruit"],
] as const;

const logos = {
  chapterHorizontal: {
    src: "/brand/gdgoc-sahmyook-horizontal.png",
    className: "logo-chapter-horizontal",
    width: 1474,
    height: 678,
    alt: "Google Developer Group On Campus, Sahmyook University",
  },
  gdgocHorizontal: {
    src: "/brand/gdgoc-on-campus-horizontal.png",
    className: "logo-gdgoc-horizontal",
    width: 1968,
    height: 506,
    alt: "Google Developer Group on Campus",
  },
  chapterStacked: {
    src: "/brand/gdgoc-sahmyook-stacked.png",
    className: "logo-chapter-stacked",
    width: 1304,
    height: 766,
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
        <nav className="desktop-nav" aria-label="주요 메뉴">
          {navigation.map(([label, href]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
          <Link href="/recruit" className="button button-small">
            Join us <span aria-hidden="true">↗</span>
          </Link>
        </nav>
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
          <a href="https://developers.google.com/community/gdg-on-campus" target="_blank" rel="noreferrer">
            GDG on Campus <span aria-hidden="true">↗</span>
          </a>
          <span>공식 채널 준비 중</span>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} GDGoC Sahmyook</span>
        <span>Google의 공식 웹사이트가 아닙니다.</span>
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
