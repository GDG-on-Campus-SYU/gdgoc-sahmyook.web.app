"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { readPublicCollection, readPublicDocument, validDocumentId } from "@/lib/public-archive";

export function usePublicCollection<T>(
  collectionName: string,
  visibilityField: "published" | "visible" = "published",
  enabled = true,
  featuredCount = 0,
) {
  const [items, setItems] = useState<T[]>([]);
  const [cached, setCached] = useState(false);
  const [loading, setLoading] = useState(Boolean(db) && enabled);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!db || !enabled) return;
    let active = true;

    readPublicCollection<T>(db, collectionName, visibilityField, featuredCount)
      .then((result) => {
        if (!active) return;
        setItems(result.items);
        setCached(result.cached);
      })
      .catch(() => active && setError(true))
      .finally(() => active && setLoading(false));

    return () => { active = false; };
  }, [collectionName, visibilityField, enabled, attempt, featuredCount]);

  return { items, cached, loading, error, retry: () => { setError(false); setLoading(true); setAttempt((value) => value + 1); } };
}

export function usePublicDocument<T>(collectionName: string, id: string | null, lookupSlug = false) {
  const [result, setResult] = useState<{ key: string; item?: T; error: boolean }>();
  const [attempt, setAttempt] = useState(0);
  const key = `${collectionName}/${lookupSlug ? "slug" : "id"}/${id ?? ""}`;

  useEffect(() => {
    if (!db || !validDocumentId(id)) return;

    let active = true;
    readPublicDocument<T>(db, collectionName, id, lookupSlug)
      .then((item) => {
        if (active) setResult({ key, item, error: false });
      })
      .catch(() => {
        if (active) setResult({ key, error: true });
      });

    return () => { active = false; };
  }, [collectionName, id, key, attempt, lookupSlug]);

  const retry = () => { setResult(undefined); setAttempt((value) => value + 1); };
  if (!db) return { item: undefined, loading: false, error: false, retry };
  if (!validDocumentId(id)) return { item: undefined, loading: false, error: false, retry };
  return {
    item: result?.key === key ? result.item : undefined,
    loading: result?.key !== key,
    error: result?.key === key && result.error,
    retry,
  };
}
