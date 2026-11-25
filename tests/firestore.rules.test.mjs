import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { collection, deleteField, doc, getDoc, getDocs, query, setDoc, Timestamp, updateDoc, where, writeBatch } from "firebase/firestore";
import { AdminConflict, saveAdminDocument, setAdminArchived, setAdminCurrent } from "../src/lib/admin-writes.ts";

const projectId = "demo-gdgoc-rules";
let environment;

before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: "127.0.0.1",
      port: Number(process.env.FIRESTORE_EMULATOR_HOST?.split(":").at(-1) ?? 8189),
      rules: await readFile("firestore.rules", "utf8"),
    },
  });
});

after(async () => environment?.cleanup());
beforeEach(async () => environment.clearFirestore());

async function seed() {
  await environment.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    await setDoc(doc(firestore, "users", "editor-user"), { role: "editor" });
    await setDoc(doc(firestore, "users", "member-user"), { role: "member" });
    await setDoc(doc(firestore, "activities", "public"), activity({ published: true }));
    await setDoc(doc(firestore, "activities", "private"), activity({ published: false }));
    await setDoc(doc(firestore, "members", "visible"), member({ visible: true }));
    await setDoc(doc(firestore, "internalMetadata", "members", "documents", "visible"), { consentConfirmedAt: Timestamp.now(), consentConfirmedBy: "editor-user" });
    await setDoc(doc(firestore, "members", "hidden"), member({ visible: false }));
  });
}

function activity(overrides = {}) {
  return {
    title: "활동",
    slug: "activity",
    summary: "설명",
    category: "Study",
    status: "예정",
    generation: "2026-2",
    published: false,
    ...overrides,
  };
}

function member(overrides = {}) {
  return {
    name: "구성원",
    role: "Member",
    activityGenerations: ["2026-2"],
    visible: false,
    ...overrides,
  };
}

test("anonymous users only read explicitly public content", async () => {
  await seed();
  const firestore = environment.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(firestore, "activities", "public")));
  await assertFails(getDoc(doc(firestore, "activities", "private")));
  await assertSucceeds(getDoc(doc(firestore, "members", "visible")));
  await assertFails(getDoc(doc(firestore, "members", "hidden")));
  await assertFails(getDoc(doc(firestore, "internalMetadata", "members", "documents", "visible")));
});

test("editors can write valid content and archive without deleting", async () => {
  await seed();
  const editor = environment.authenticatedContext("editor-user").firestore();
  const anonymous = environment.unauthenticatedContext().firestore();
  const target = doc(editor, "activities", "activity");

  await assertSucceeds(setDoc(target, activity({ published: true })));
  await assertSucceeds(setDoc(target, activity({ published: false, archivedAt: Timestamp.now() })));
  await assertFails(getDoc(doc(anonymous, "activities", "activity")));
  await assertFails(setDoc(doc(editor, "activities", "audit"), activity({ slug: "audit", published: true, createdBy: "editor-user" })));
});

test("editors can update legacy member documents during migration", async () => {
  await seed();
  const editor = environment.authenticatedContext("editor-user").firestore();
  await assertSucceeds(setDoc(doc(editor, "members", "legacy"), member({
    generation: "2026-2",
    activityGenerations: ["2026-2"],
    profileImage: "https://example.com/legacy.png",
  })));
});

test("members keep one profile with generation-specific role history", async () => {
  await seed();
  const editor = environment.authenticatedContext("editor-user").firestore();
  await assertSucceeds(setDoc(doc(editor, "members", "history"), member({
    generationHistory: [{ generationId: "2026-2", role: "Member", position: "웹" }],
  })));
  await assertFails(setDoc(doc(editor, "members", "oversized-history"), member({
    generationHistory: Array.from({ length: 21 }, () => ({ generationId: "2026-2", role: "Member" })),
  })));
});

test("invalid fields, enums and date ranges are rejected", async () => {
  await seed();
  const editor = environment.authenticatedContext("editor-user").firestore();

  await assertFails(setDoc(doc(editor, "activities", "unknown"), activity({ slug: "unknown", unexpected: true })));
  await assertFails(setDoc(doc(editor, "activities", "status"), activity({ slug: "status", status: "invalid" })));
  await assertFails(setDoc(doc(editor, "activities", "dates"), activity({ slug: "dates", startDate: "2026-09-28", endDate: "2026-09-27" })));
  await assertFails(setDoc(doc(editor, "members", "consent"), {
    name: "구성원",
    role: "Member",
    activityGenerations: ["2026-2"],
    visible: true,
  }));
  await assertFails(setDoc(doc(editor, "members", "leaked-consent"), member({ consentConfirmedBy: "editor-user" })));
  await assertFails(setDoc(doc(editor, "recruitment", "invalid-url"), {
    title: "모집",
    description: "설명",
    status: "open",
    applyUrl: "ftp://example.com",
    roles: ["Member"],
    published: false,
  }));
});

test("recruitment supports an optional Korean cutoff tied to its end date", async () => {
  await seed();
  const editor = environment.authenticatedContext("editor-user").firestore();
  const target = doc(editor, "recruitment", "cutoff");
  const posting = { title: "모집", description: "설명", status: "open", applyUrl: "https://example.test/apply", published: true };
  await assertSucceeds(setDoc(target, posting));
  await assertFails(updateDoc(target, { endTime: "18:00" }));
  await assertSucceeds(updateDoc(target, { endDate: "2026-09-12", endTime: "18:00" }));
  for (const endTime of ["24:00", "18:60", "6:00", 18]) await assertFails(updateDoc(target, { endTime }));
  await assertFails(updateDoc(target, { endDate: "" }));
  await assertSucceeds(updateDoc(target, { endTime: "" }));
  await assertSucceeds(updateDoc(target, { endDate: "", endTime: "" }));
});

test("a public member needs private consent metadata in the same batch", async () => {
  await seed();
  const editor = environment.authenticatedContext("editor-user").firestore();
  const anonymous = environment.unauthenticatedContext().firestore();
  const memberUser = environment.authenticatedContext("member-user").firestore();
  const publicMember = doc(editor, "members", "new-visible");
  const metadata = doc(editor, "internalMetadata", "members", "documents", "new-visible");

  await assertFails(setDoc(publicMember, member({ visible: true })));
  const batch = writeBatch(editor);
  batch.set(publicMember, member({ visible: true }));
  batch.set(metadata, { createdBy: "editor-user", consentConfirmedAt: Timestamp.now(), consentConfirmedBy: "editor-user" });
  await assertSucceeds(batch.commit());
  const publicData = (await assertSucceeds(getDoc(doc(anonymous, "members", "new-visible")))).data();
  assert.equal(publicData?.consentConfirmedBy, undefined);
  assert.equal(publicData?.createdBy, undefined);
  await assertFails(getDoc(doc(anonymous, "internalMetadata", "members", "documents", "new-visible")));
  await assertFails(setDoc(doc(memberUser, "internalMetadata", "members", "documents", "new-visible"), { consentConfirmedBy: "member-user" }));
  await assertSucceeds(getDoc(metadata));
});

test("generation catalog entries can be archived without deletion", async () => {
  await seed();
  const editor = environment.authenticatedContext("editor-user").firestore();
  const target = doc(editor, "generations", "2026-2");
  await assertSucceeds(setDoc(target, { label: "2026년 2기", published: true }));
  await assertSucceeds(setDoc(target, { label: "2026년 2기", published: false, archivedAt: Timestamp.now() }));
});

test("current generation is public but only editors can change it", async () => {
  await seed();
  const editor = environment.authenticatedContext("editor-user").firestore();
  const memberUser = environment.authenticatedContext("member-user").firestore();
  const anonymous = environment.unauthenticatedContext().firestore();
  const target = doc(editor, "generations", "current");
  const payload = { generationId: "2026-2", label: "2026년 2기", published: true, updatedAt: Timestamp.now() };

  await setDoc(doc(editor, "generations", "2026-2"), { label: payload.label, published: true });
  await assertSucceeds(setDoc(target, payload));
  await assertSucceeds(getDoc(doc(anonymous, "generations", "current")));
  await assertFails(setDoc(doc(memberUser, "generations", "current"), payload));
});

test("archived content requires a private restore before publication", async () => {
  await seed();
  const editor = environment.authenticatedContext("editor-user").firestore();
  const publicDb = environment.unauthenticatedContext().firestore();
  for (const [name, id, field] of [["members", "visible", "visible"], ["activities", "public", "published"]]) {
    const target = doc(editor, name, id);
    const anonymousRef = doc(publicDb, name, id);
    const publicQuery = query(collection(publicDb, name), where(field, "==", true));
    await setAdminArchived(await getDoc(target), true, "editor-user");
    assert.equal((await getDocs(publicQuery)).size, 0);
    await assertFails(getDoc(anonymousRef));
    await assertFails(updateDoc(target, { [field]: true }));
    await assertFails(updateDoc(target, { archivedAt: deleteField(), [field]: true }));
    await setAdminArchived(await getDoc(target), false, "editor-user");
    assert.equal((await getDocs(publicQuery)).size, 0);
    const restored = await getDoc(target);
    assert.equal(restored.get("archivedAt"), undefined);
    await saveAdminDocument(target, restored, { [field]: true }, "editor-user");
    assert.equal((await getDocs(publicQuery)).size, 1);
    assert.equal((await getDoc(anonymousRef)).get(field), true);
  }
});

test("admin transactions reject duplicate creates and stale edits of legacy documents", async () => {
  await seed();
  const editorA = environment.authenticatedContext("editor-user").firestore();
  const editorB = environment.authenticatedContext("editor-user").firestore();
  const create = (db, title) => saveAdminDocument(doc(db, "activities", "same"), null, activity({ slug: "same", title }), "editor-user");
  const results = await Promise.allSettled([create(editorA, "A"), create(editorB, "B")]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.ok(results.find((result) => result.status === "rejected").reason instanceof AdminConflict);

  const previous = (await getDocs(collection(editorA, "activities"))).docs.find((item) => item.id === "public");
  assert.equal(previous.get("updatedAt"), undefined);
  await updateDoc(doc(editorB, "activities", "public"), { title: "예전 편집기에서 변경" });
  await assert.rejects(saveAdminDocument(previous.ref, previous, { title: "덮어쓰기" }, "editor-user"), AdminConflict);
  const fresh = await getDoc(doc(editorB, "activities", "public"));
  assert.equal(fresh.get("updatedAt"), undefined);
  await saveAdminDocument(fresh.ref, fresh, { title: "새 제목", published: false, order: 0 }, "editor-user");
  await assert.rejects(saveAdminDocument(previous.ref, previous, { title: "오래된 제목", published: true }, "editor-user"), AdminConflict);
  const latest = await getDoc(previous.ref);
  assert.equal(latest.get("title"), "새 제목");
  assert.equal(latest.get("published"), false);
  assert.equal(latest.get("order"), 0);
  await saveAdminDocument(latest.ref, latest, { order: deleteField() }, "editor-user");
  assert.equal((await getDoc(previous.ref)).get("order"), undefined);
});

test("current generation tracks the catalog and reserved ID even while labels change", async () => {
  await seed();
  const editor = environment.authenticatedContext("editor-user").firestore();
  const first = doc(editor, "generations", "first");
  const next = doc(editor, "generations", "next");
  const pointer = doc(editor, "generations", "current");
  await assertFails(setDoc(pointer, { label: "예약 ID", published: true }));
  await setDoc(first, { label: "기존", published: true });
  await setDoc(next, { label: "다음", published: true });
  await setAdminCurrent(await getDoc(first), null, "editor-user");
  await assertFails(updateDoc(first, { published: false }));
  await assertFails(updateDoc(first, { label: "독립 수정" }));
  await assertFails(updateDoc(pointer, { generationId: "missing" }));
  await saveAdminDocument(first, await getDoc(first), { label: "새 이름", published: true }, "editor-user");
  assert.equal((await getDoc(pointer)).get("label"), "새 이름");
  await setAdminCurrent(await getDoc(next), await getDoc(pointer), "editor-user");
  await setAdminArchived(await getDoc(first), true, "editor-user");
  assert.equal((await getDoc(first)).get("published"), false);
  assert.equal((await getDoc(pointer)).get("generationId"), next.id);
});

test("new activity and project slugs match the ID, existing shared slugs remain editable", async () => {
  await seed();
  const editor = environment.authenticatedContext("editor-user").firestore();
  for (const [name, data] of [["activities", activity()], ["projects", { title: "작품", summary: "설명", published: true }]]) {
    const target = doc(editor, name, "활동");
    await assertFails(setDoc(target, { ...data, slug: "다른주소" }));
    await assertSucceeds(setDoc(target, { ...data, slug: target.id }));
    await assertFails(updateDoc(target, { slug: "다른주소" }));
  }
  await assertSucceeds(updateDoc(doc(editor, "activities", "public"), { title: "기존 문서 편집" }));
});

test("users cannot grant themselves an editor role", async () => {
  await seed();
  const memberUser = environment.authenticatedContext("member-user").firestore();
  await assertFails(setDoc(doc(memberUser, "users", "member-user"), { role: "admin" }));
  assert.ok(true);
});
