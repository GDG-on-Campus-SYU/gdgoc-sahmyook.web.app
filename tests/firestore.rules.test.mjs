import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";

const projectId = "gdgoc-sahmyook-rules-test";
let environment;

before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: "127.0.0.1",
      port: 8189,
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
    consentConfirmedAt: Timestamp.now(),
    consentConfirmedBy: "editor-user",
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
});

test("editors can write valid content and archive without deleting", async () => {
  await seed();
  const editor = environment.authenticatedContext("editor-user").firestore();
  const anonymous = environment.unauthenticatedContext().firestore();
  const target = doc(editor, "activities", "new-activity");

  await assertSucceeds(setDoc(target, activity({ published: true })));
  await assertSucceeds(setDoc(target, activity({ published: false, archivedBy: "editor-user", archivedAt: Timestamp.now() })));
  await assertFails(getDoc(doc(anonymous, "activities", "new-activity")));
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

test("invalid fields, enums and date ranges are rejected", async () => {
  await seed();
  const editor = environment.authenticatedContext("editor-user").firestore();

  await assertFails(setDoc(doc(editor, "activities", "unknown"), activity({ unexpected: true })));
  await assertFails(setDoc(doc(editor, "activities", "status"), activity({ status: "invalid" })));
  await assertFails(setDoc(doc(editor, "activities", "dates"), activity({ startDate: "2026-09-28", endDate: "2026-09-27" })));
  await assertFails(setDoc(doc(editor, "members", "consent"), {
    name: "구성원",
    role: "Member",
    activityGenerations: ["2026-2"],
    visible: true,
  }));
  await assertFails(setDoc(doc(editor, "recruitment", "invalid-url"), {
    title: "모집",
    description: "설명",
    status: "open",
    applyUrl: "ftp://example.com",
    roles: ["Member"],
    published: false,
  }));
});

test("generation catalog entries can be archived without deletion", async () => {
  await seed();
  const editor = environment.authenticatedContext("editor-user").firestore();
  const target = doc(editor, "generations", "2026-2");
  await assertSucceeds(setDoc(target, { label: "2026년 2기", published: true }));
  await assertSucceeds(setDoc(target, { label: "2026년 2기", published: false, archivedAt: Timestamp.now(), archivedBy: "editor-user" }));
});

test("current generation is public but only editors can change it", async () => {
  await seed();
  const editor = environment.authenticatedContext("editor-user").firestore();
  const memberUser = environment.authenticatedContext("member-user").firestore();
  const anonymous = environment.unauthenticatedContext().firestore();
  const target = doc(editor, "generations", "current");
  const payload = { generationId: "2026-2", label: "2026년 2기", published: true, updatedAt: Timestamp.now(), updatedBy: "editor-user" };

  await assertSucceeds(setDoc(target, payload));
  await assertSucceeds(getDoc(doc(anonymous, "generations", "current")));
  await assertFails(setDoc(doc(memberUser, "generations", "current"), payload));
});

test("users cannot grant themselves an editor role", async () => {
  await seed();
  const memberUser = environment.authenticatedContext("member-user").firestore();
  await assertFails(setDoc(doc(memberUser, "users", "member-user"), { role: "admin" }));
  assert.ok(true);
});
