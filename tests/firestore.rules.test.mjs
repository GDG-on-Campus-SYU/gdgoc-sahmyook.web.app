import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, Timestamp, writeBatch } from "firebase/firestore";

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
  const target = doc(editor, "activities", "new-activity");

  await assertSucceeds(setDoc(target, activity({ published: true })));
  await assertSucceeds(setDoc(target, activity({ published: false, archivedAt: Timestamp.now() })));
  await assertFails(getDoc(doc(anonymous, "activities", "new-activity")));
  await assertFails(setDoc(target, activity({ published: true, createdBy: "editor-user" })));
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

  await assertFails(setDoc(doc(editor, "activities", "unknown"), activity({ unexpected: true })));
  await assertFails(setDoc(doc(editor, "activities", "status"), activity({ status: "invalid" })));
  await assertFails(setDoc(doc(editor, "activities", "dates"), activity({ startDate: "2026-09-28", endDate: "2026-09-27" })));
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
