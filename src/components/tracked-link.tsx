"use client";

import { trackAnalyticsEvent } from "@/lib/analytics-consent";

export function TrackedLink({ href, event, children, external = false }: { href: string; event: string; children: React.ReactNode; external?: boolean }) {
  return <a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} onClick={() => trackAnalyticsEvent(event)}>{children}</a>;
}
