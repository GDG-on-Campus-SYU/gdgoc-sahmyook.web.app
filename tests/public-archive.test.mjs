import assert from "node:assert/strict";
import { test } from "node:test";
import { allArchiveItems, archiveHref, archiveListHref, completeFeaturedOrders, generationOptions, readArchiveFilters, validDocumentId } from "../src/lib/public-archive.ts";

test("generation filters prefer the catalog and retain a label from a legacy pointer", () => {
  const id = "2026-2027";
  const catalog = { id, label: "2026-2027", order: 1 };
  const pointer = { id: "current", generationId: id, label: "2026–2027" };
  for (const rows of [[catalog, pointer], [pointer, catalog]]) {
    assert.deepEqual(generationOptions(rows, [id, "old", id]), [[id, catalog.label], ["old", "old"]]);
  }
  assert.deepEqual(generationOptions([pointer], [id]), [[id, pointer.label]]);
});

test("archive addresses preserve Korean IDs and distinguish older documents from their slugs", () => {
  for (const collection of ["activities", "projects"]) {
    for (const [id, slug] of [["한글-1", "한글-1"], ["old+id", "옛 이름"]]) {
      const url = new URL(archiveHref(collection, { id, slug }), "https://example.test");
      assert.equal(url.pathname, `/${collection}/detail/`);
      assert.equal(url.searchParams.get("slug"), slug);
      assert.equal(url.searchParams.get("id"), id === slug ? null : id);
    }
  }
  for (const key of [null, "", "  ", "/", "a/b", ".", "..", "__reserved__", "가".repeat(501)]) assert.equal(validDocumentId(key), false);
  for (const key of ["한글-1", "old+id", "old.name", "가".repeat(500)]) assert.equal(validDocumentId(key), true);
});

test("the featured query preserves missing orders and unresolved date/title ties", () => {
  assert.equal(completeFeaturedOrders([-1, 0, 2, 7], 3), true);
  assert.equal(completeFeaturedOrders([3, 3], 2), true);
  for (const orders of [[], [1], [1, 2, 2], [1, 999], [1000, 1001], [null, 1], [NaN, 1]]) {
    assert.equal(completeFeaturedOrders(orders, 2), false);
  }
});

test("detail return links preserve supported filters without retaining IDs or unrelated query keys", () => {
  const params = new URLSearchParams({ generation: "한글+기수", category: "Study", tracking: "discard" });
  const item = { id: "old+id", slug: "옛 주소" };
  for (const name of ["activities", "projects"]) {
    const filters = readArchiveFilters(name, params);
    const detail = new URL(archiveHref(name, item, filters), "https://example.test");
    const list = new URL(archiveListHref(name, readArchiveFilters(name, detail.searchParams)), detail);
    assert.equal(list.pathname, `/${name}/`);
    assert.deepEqual(Object.fromEntries(list.searchParams), name === "activities"
      ? { generation: "한글+기수", category: "Study" } : { generation: "한글+기수" });
    assert.equal(detail.searchParams.get("id"), item.id);
    assert.equal(detail.searchParams.get("slug"), item.slug);
    assert.equal(archiveListHref(name, allArchiveItems), `/${name}/`);
  }
  assert.deepEqual(readArchiveFilters("activities", new URLSearchParams("generation=a/b&category=unknown")), allArchiveItems);
});
