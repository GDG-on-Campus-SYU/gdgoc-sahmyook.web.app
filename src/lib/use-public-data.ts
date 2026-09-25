"use client";

import { collection, getDocs, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";

export function usePublicCollection<T>(
  collectionName: string,
  fallback: T[],
  visibilityField: "published" | "visible" = "published",
) {
  const [items, setItems] = useState(fallback);
  const [loading, setLoading] = useState(Boolean(db));
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!db) return;
    let active = true;

    getDocs(query(collection(db, collectionName), where(visibilityField, "==", true)))
      .then((snapshot) => {
        if (!active) return;
        const liveItems = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T);
        setItems(liveItems.length ? liveItems : fallback);
      })
      .catch(() => active && setError(true))
      .finally(() => active && setLoading(false));

    return () => { active = false; };
  }, [collectionName, fallback, visibilityField]);

  return { items, loading, error };
}
