import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { disableNetwork, doc, enableNetwork, writeBatch } from "firebase/firestore";
import { compareActivities, compareProjects, readPublicCollection, readPublicDocument } from "../src/lib/public-archive.ts";

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-gdgoc-rules",
    firestore: { rules: await readFile("firestore.rules", "utf8") },
  });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const batch = writeBatch(db);
    for (const name of ["activities", "projects"]) {
      for (let n = 0; n < 50; n++) {
        const id = String(n);
        batch.set(doc(db, name, id), { slug: id, title: `항목 ${n}`, published: true, order: n });
      }
      batch.set(doc(db, name, "기존-ID"), { slug: "옛-주소", title: "나", published: true });
      batch.set(doc(db, name, "숨김"), { slug: "비공개-주소", title: "비공개", published: false });
    }
    await batch.commit();
  });
});
after(async () => env?.cleanup());

test("featured results match the entire sorted archive with bounded reads, including legacy fallback", async () => {
  const db = env.unauthenticatedContext().firestore();
  for (const [name, count, compare] of [["activities", 3, compareActivities], ["projects", 2, compareProjects]]) {
    const archive = await readPublicCollection(db, name, "published");
    const sample = await readPublicCollection(db, name, "published", count);
    assert.equal(archive.items.length, 51);
    assert.equal(sample.items.length, count + 1);
    assert.deepEqual(sample.items.sort(compare).slice(0, count), archive.items.sort(compare).slice(0, count));
    assert.equal((await readPublicDocument(db, name, "1", true)).id, "1");
    assert.equal((await readPublicDocument(db, name, "기존-ID", false)).slug, "옛-주소");
    assert.equal((await readPublicDocument(db, name, "옛-주소", true)).id, "기존-ID");
    assert.equal(await readPublicDocument(db, name, "누락", true), undefined);
    assert.equal(await readPublicDocument(db, name, "숨김", false), undefined);
    assert.equal(await readPublicDocument(db, name, "비공개-주소", true), undefined);
  }
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const batch = writeBatch(db);
    for (let n = 0; n < 50; n++) batch.update(doc(db, "projects", String(n)), { order: 1000 });
    await batch.commit();
  });
  const legacy = await readPublicCollection(db, "projects", "published", 2);
  assert.equal(legacy.items.sort(compareProjects)[0].id, "기존-ID");
});

test("offline empty results can be retried and populated cached results are identified", async () => {
  const db = env.unauthenticatedContext().firestore();
  await disableNetwork(db);
  await assert.rejects(readPublicCollection(db, "activities", "published"), /offline/);
  await enableNetwork(db);
  const online = await readPublicCollection(db, "activities", "published");
  assert.ok(online.items.length && !online.cached);
  assert.deepEqual(await readPublicCollection(db, "members", "visible"), { items: [], cached: false });
  await disableNetwork(db);
  const cached = await readPublicCollection(db, "activities", "published");
  assert.equal(cached.cached, true);
  assert.deepEqual(cached.items, online.items);
  await enableNetwork(db);
});
