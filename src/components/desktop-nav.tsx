"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function DesktopNav({ items }: { items: ReadonlyArray<readonly [string, string]> }) {
  const pathname = usePathname();
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="desktop-nav" aria-label="주요 메뉴">
      {items.map(([label, href]) => <Link key={href} href={href} className={href === "/recruit" ? "button button-small" : undefined} aria-current={active(href) ? "page" : undefined}>{label}</Link>)}
    </nav>
  );
}
