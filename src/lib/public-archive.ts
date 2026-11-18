import { collection, doc, getDoc, getDocs, limit, orderBy, query, where, type Firestore, type QuerySnapshot } from "firebase/firestore";
import type { Activity, Project } from "@/types/content";

export function compareActivities(a: Activity, b: Activity) {
  return (a.order ?? 999) - (b.order ?? 999) || (b.startDate || "").localeCompare(a.startDate || "") || a.title.localeCompare(b.title, "ko") || a.id.localeCompare(b.id);
}

export function compareProjects(a: Project, b: Project) {
  return (a.order ?? 999) - (b.order ?? 999) || a.title.localeCompare(b.title, "ko") || a.id.localeCompare(b.id);
}

export function validDocumentId(id: string | null): id is string {
  if (!id || !id.trim()) return false;
  return id !== "." && id !== ".." && !id.includes("/")
    && !/^__.*__$/.test(id) && new TextEncoder().encode(id).length <= 1500;
}

function publicRows<T>(snapshot: QuerySnapshot) {
  if (snapshot.empty && snapshot.metadata.fromCache) throw new Error("No cached results while offline");
  return {
    items: snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as T),
    cached: snapshot.metadata.fromCache,
  };
}

export function completeFeaturedOrders(orders: unknown[], count: number) {
  const cutoff = orders[count - 1];
  // A missing order ranks as 999. An equal next order could win on date or Korean title.
  return typeof cutoff === "number" && cutoff < 999
    && orders.every((order) => typeof order === "number" && Number.isFinite(order))
    && (orders.length === count || Number(orders[count]) > cutoff);
}

export async function readPublicCollection<T>(db: Firestore, name: string, visibility: string, featuredCount = 0) {
  const visible = query(collection(db, name), where(visibility, "==", true));
  if (featuredCount) {
    try {
      const sample = await getDocs(query(visible, orderBy("order"), limit(featuredCount + 1)));
      if (!sample.metadata.fromCache && completeFeaturedOrders(sample.docs.map((d) => d.get("order")), featuredCount)) {
        return publicRows<T>(sample);
      }
    } catch (error) {
      // The full query also works while the new composite index is building.
      if ((error as { code?: string }).code !== "failed-precondition") throw error;
    }
  }
  return publicRows<T>(await getDocs(visible));
}

export function archiveHref(name: "activities" | "projects", item: { id: string; slug: string }) {
  const params = new URLSearchParams({ slug: item.slug });
  if (item.id !== item.slug) params.set("id", item.id);
  return `/${name}/detail/?${params}`;
}

export async function readPublicDocument<T>(db: Firestore, name: string, id: string, lookupSlug: boolean) {
  try {
    const snapshot = await getDoc(doc(db, name, id));
    const data = snapshot.data();
    if (data?.published === true && (!lookupSlug || data.slug === id)) return { ...data, id: snapshot.id } as T;
  } catch (error) {
    if ((error as { code?: string }).code !== "permission-denied") throw error;
  }
  if (!lookupSlug) return undefined;
  const matches = await getDocs(query(collection(db, name), where("published", "==", true), where("slug", "==", id), limit(1)));
  return publicRows<T>(matches).items[0];
}
