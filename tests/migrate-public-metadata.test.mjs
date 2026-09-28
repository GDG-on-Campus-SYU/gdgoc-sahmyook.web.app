import assert from "node:assert/strict";
import { test } from "node:test";
import { migrationWrites, planDocument } from "../scripts/migrate-public-metadata.mjs";

test("moves consent and author fields without changing public content", () => {
  const consent = { timestampValue: "2026-09-28T00:00:00Z" };
  const document = { name: "projects/test/databases/(default)/documents/members/a", updateTime: "2026-09-28T01:00:00Z", fields: { name: { stringValue: "구성원" }, visible: { booleanValue: true }, consentConfirmedAt: consent, consentConfirmedBy: { stringValue: "editor" } } };
  const plan = planDocument(document, null, "members");
  assert.deepEqual(plan.issues, []);
  assert.deepEqual(Object.keys(plan.publicFields), ["name", "visible"]);
  assert.deepEqual(plan.metadataFields, { consentConfirmedAt: consent, consentConfirmedBy: { stringValue: "editor" } });
  assert.ok("consentConfirmedAt" in document.fields);
  const writes = migrationWrites(document, null, "projects/test/databases/(default)/documents/internalMetadata/members/documents/a", plan);
  assert.deepEqual(writes[0].currentDocument, { exists: false });
  assert.deepEqual(writes[1].currentDocument, { updateTime: document.updateTime });
  assert.deepEqual(writes[1].update.fields, { name: document.fields.name, visible: document.fields.visible });
});

test("blocks conflicts and visible members without consent", () => {
  const document = { fields: { name: { stringValue: "구성원" }, visible: { booleanValue: true }, updatedBy: { stringValue: "new" } } };
  const metadata = { fields: { updatedBy: { stringValue: "old" } } };
  assert.deepEqual(planDocument(document, metadata, "members").issues, ["metadata-conflict", "visible-member-missing-consent"]);
});
