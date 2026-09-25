"use client";

import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";

export type CurrentGeneration = { generationId: string; label: string };

export const fallbackGeneration: CurrentGeneration = {
  generationId: "2026-2027",
  label: "2026–2027",
};

let currentGenerationRequest: Promise<CurrentGeneration> | null = null;

export function loadCurrentGeneration() {
  if (!db) return Promise.resolve(fallbackGeneration);
  if (!currentGenerationRequest) {
    currentGenerationRequest = getDoc(doc(db, "generations", "current"))
      .then((snapshot) => {
        const data = snapshot.data();
        if (!snapshot.exists() || typeof data?.generationId !== "string" || !data.generationId.trim()) return fallbackGeneration;
        return {
          generationId: data.generationId.trim(),
          label: typeof data.label === "string" && data.label.trim() ? data.label.trim() : data.generationId.trim(),
        };
      })
      .finally(() => { currentGenerationRequest = null; });
  }
  return currentGenerationRequest;
}

export function useCurrentGeneration() {
  const [generation, setGeneration] = useState(fallbackGeneration);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(Boolean(db));

  useEffect(() => {
    let active = true;
    loadCurrentGeneration()
      .then((value) => active && setGeneration(value))
      .catch(() => active && setError(true))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  return { generation, error, loading };
}
