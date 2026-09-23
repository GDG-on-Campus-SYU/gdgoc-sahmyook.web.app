"use client";

import Link from "next/link";
import { useRef } from "react";

export function MobileNav({ items }: { items: ReadonlyArray<readonly [string, string]> }) {
  const menu = useRef<HTMLDetailsElement>(null);

  return (
    <details className="mobile-nav" ref={menu}>
      <summary aria-label="메뉴 열기 또는 닫기">
        <span />
        <span />
        <span />
      </summary>
      <nav aria-label="모바일 메뉴">
        {items.map(([label, href]) => (
          <Link key={href} href={href} onClick={() => menu.current?.removeAttribute("open")}>
            {label}
          </Link>
        ))}
      </nav>
    </details>
  );
}
