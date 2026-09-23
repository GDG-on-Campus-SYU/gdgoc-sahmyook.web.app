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

    getDocs(query(collection(db, collectionName), where(visibilityField, "==", true)))
      .then((snapshot) => {
        const liveItems = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T);
        setItems(liveItems.length ? liveItems : fallback);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [collectionName, fallback, visibilityField]);

  return { items, loading, error };
}
