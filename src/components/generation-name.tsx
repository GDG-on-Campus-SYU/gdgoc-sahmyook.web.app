"use client";

import { usePublicDocument } from "@/lib/use-public-data";
import type { Generation } from "@/types/content";

export function GenerationName({ id }: { id?: string }) {
  const { item } = usePublicDocument<Generation>("generations", id || null);
  return item?.label || id || "미정";
}
