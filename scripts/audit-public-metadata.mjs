// Read-only dry run: inspect fields visible to an unauthenticated Firestore client.
import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile(".env");

const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
if (!project || !key) throw new Error("Firebase project ID and web API key are required");

const endpoint = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents`;
const sensitive = ["createdBy", "updatedBy", "archivedBy", "consentConfirmedAt", "consentConfirmedBy"];

async function inspectCollection(name, visibilityField) {
  const response = await fetch(`${endpoint}:runQuery?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: name }],
      where: { fieldFilter: { field: { fieldPath: visibilityField }, op: "EQUAL", value: { booleanValue: true } } },
    } }),
  });
  if (!response.ok) throw new Error(`${name}: Firestore returned HTTP ${response.status}`);
  const results = await response.json();
  if (!Array.isArray(results)) throw new Error(`${name}: unexpected Firestore response`);
  const documents = results.filter((result) => result.document);
  const exposed = Object.fromEntries(sensitive.map((field) => [field, documents.filter(({ document }) => field in (document.fields || {})).length]));
  return { collection: name, publicDocuments: documents.length, exposed };
}

for (const [name, field] of [["members", "visible"], ["activities", "published"], ["projects", "published"], ["recruitment", "published"], ["generations", "published"]]) {
  console.log(JSON.stringify(await inspectCollection(name, field)));
}
const current = await fetch(`${endpoint}/generations/current?key=${encodeURIComponent(key)}`);
if (current.status !== 404) {
  if (!current.ok) throw new Error(`generations/current: Firestore returned HTTP ${current.status}`);
  const fields = (await current.json()).fields || {};
  console.log(JSON.stringify({ collection: "generations/current", publicDocuments: 1, exposed: Object.fromEntries(sensitive.map((field) => [field, Number(field in fields)])) }));
}
console.log("This unauthenticated audit cannot inspect private drafts or internal metadata; no documents were changed.");
