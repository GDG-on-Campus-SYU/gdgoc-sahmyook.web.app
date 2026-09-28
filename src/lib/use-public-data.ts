"use client";

import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";

export function usePublicCollection<T>(
  collectionName: string,
  visibilityField: "published" | "visible" = "published",
  enabled = true,
) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(Boolean(db) && enabled);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!db || !enabled) return;
    let active = true;

    getDocs(query(collection(db, collectionName), where(visibilityField, "==", true)))
      .then((snapshot) => {
        if (!active) return;
        setItems(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T));
      })
      .catch(() => active && setError(true))
      .finally(() => active && setLoading(false));

    return () => { active = false; };
  }, [collectionName, visibilityField, enabled]);

  return { items, loading, error };
}

export function usePublicDocument<T>(collectionName: string, id: string | null) {
  const [result, setResult] = useState<{ key: string; item?: T; error: boolean }>();
  const key = `${collectionName}/${id ?? ""}`;

  useEffect(() => {
    if (!db || !id) return;

    let active = true;
    const activeDb = db;

    getDoc(doc(activeDb, collectionName, id))
      .then((snapshot) => {
        if (!active) return;
        setResult({
          key,
          item: snapshot.exists() && snapshot.data().published === true
            ? { id: snapshot.id, ...snapshot.data() } as T
            : undefined,
          error: false,
        });
      })
      .catch((reason: unknown) => {
        if (active) setResult({ key, error: (reason as { code?: string }).code !== "permission-denied" });
      });

    return () => { active = false; };
  }, [collectionName, id, key]);

  if (!db) return { item: undefined, loading: false, error: false };
  if (!id) return { item: undefined, loading: false, error: false };
  return {
    item: result?.key === key ? result.item : undefined,
    loading: result?.key !== key,
    error: result?.key === key && result.error,
  };
}
