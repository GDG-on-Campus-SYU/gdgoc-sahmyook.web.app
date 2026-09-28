"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function DesktopNav({ items }: { items: ReadonlyArray<readonly [string, string]> }) {
  const pathname = usePathname();
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="desktop-nav" aria-label="주요 메뉴">
      {items.map(([label, href]) => <Link key={href} href={href} aria-current={active(href) ? "page" : undefined}>{label}</Link>)}
      <Link href="/recruit" className="button button-small" aria-current={active("/recruit") ? "page" : undefined}>Join us <span aria-hidden="true">↗</span></Link>
    </nav>
  );
}
