import { sign } from "node:crypto";

const project = process.env.FIREBASE_PROJECT_ID;
const mode = process.env.MIGRATION_MODE;

if (project !== "gdgoc-sahmyook" || !["dry-run", "apply"].includes(mode)) {
  throw new Error("Expected approved project and dry-run/apply mode.");
}

const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "null");
if (credentials?.project_id !== project || !credentials.client_email || !credentials.private_key) {
  throw new Error("Missing service-account credentials for approved project.");
}

const now = Math.floor(Date.now() / 1000);
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
  iss: credentials.client_email,
  scope: "https://www.googleapis.com/auth/datastore",
  aud: "https://oauth2.googleapis.com/token",
  iat: now,
  exp: now + 3600,
})}`;
const assertion = `${unsigned}.${sign("RSA-SHA256", Buffer.from(unsigned), credentials.private_key).toString("base64url")}`;
const authResponse = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
});
if (!authResponse.ok) throw new Error(`OAuth token request failed: ${authResponse.status}`);
const { access_token: token } = await authResponse.json();
if (!token) throw new Error("OAuth response contained no access token.");

const resource = `projects/${project}/databases/(default)/documents`;
const base = `https://firestore.googleapis.com/v1/${resource}`;
const paths = [
  "activities/test",
  "projects/test",
  "recruitment/2026-2027",
  "members/LpIKcBtAf1Bre7AHLYOT",
  "generations/2026-2",
  "generations/current",
];

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (response.status === 404 && !options.method) return null;
  if (!response.ok) throw new Error(`Firestore ${response.status} for ${path}`);
  return response.json();
}

const docs = Object.fromEntries(await Promise.all(paths.map(async (path) => [path, await request(`/${path}`)])));
for (const [path, title] of [
  ["activities/test", "활동"],
  ["projects/test", "플젝"],
  ["recruitment/2026-2027", "우리 동아리 인원 모집합니다."],
]) {
  const item = docs[path];
  if (!item?.updateTime || item.fields?.published?.booleanValue !== true || item.fields?.title?.stringValue !== title) {
    throw new Error(`Precondition changed: ${path}`);
  }
}

const member = docs["members/LpIKcBtAf1Bre7AHLYOT"];
if (!member?.updateTime || member.fields?.visible?.booleanValue !== true ||
  member.fields?.generation?.stringValue !== "2026-2" ||
  member.fields?.github?.stringValue !== "https://github.com/singhic" ||
  member.fields?.activityGenerations || member.fields?.consentConfirmedAt ||
  docs["generations/2026-2"] ||
  docs["generations/current"]?.fields?.generationId?.stringValue !== "2026-2027") {
  throw new Error("Member or generation precondition changed.");
}

const stamp = new Date().toISOString();
const operator = "operator-confirmed-via-chat";
const timestamp = { timestampValue: stamp };
const by = { stringValue: operator };
const writes = [
  ...paths.slice(0, 3).map((path) => ({
    update: { name: docs[path].name, fields: { published: { booleanValue: false }, updatedAt: timestamp, updatedBy: by } },
    updateMask: { fieldPaths: ["published", "updatedAt", "updatedBy"] },
    currentDocument: { updateTime: docs[path].updateTime },
  })),
  {
    update: { name: member.name, fields: {
      activityGenerations: { arrayValue: { values: [{ stringValue: "2026-2" }] } },
      consentConfirmedAt: timestamp, consentConfirmedBy: by, updatedAt: timestamp, updatedBy: by,
    } },
    updateMask: { fieldPaths: ["activityGenerations", "consentConfirmedAt", "consentConfirmedBy", "updatedAt", "updatedBy"] },
    currentDocument: { updateTime: member.updateTime },
  },
  {
    update: { name: `${resource}/generations/2026-2`, fields: {
      label: { stringValue: "2026-2" }, published: { booleanValue: true },
      createdAt: timestamp, createdBy: by, updatedAt: timestamp, updatedBy: by,
    } },
    currentDocument: { exists: false },
  },
];

console.log(`Preflight passed for ${project}: 3 unpublished, 1 member updated, 1 generation created.`);
if (mode === "dry-run") process.exit(0);

const result = await request(":commit", { method: "POST", body: JSON.stringify({ writes }) });
if (result.writeResults?.length !== writes.length) throw new Error("Unexpected Firestore commit result.");

const [activity, projectDoc, recruitment, updatedMember, generation] = await Promise.all(paths.slice(0, 5).map((path) => request(`/${path}`)));
if (activity.fields.published.booleanValue !== false || projectDoc.fields.published.booleanValue !== false ||
  recruitment.fields.published.booleanValue !== false ||
  updatedMember.fields.activityGenerations.arrayValue.values[0].stringValue !== "2026-2" ||
  updatedMember.fields.consentConfirmedBy.stringValue !== operator ||
  generation.fields.label.stringValue !== "2026-2" || generation.fields.published.booleanValue !== true) {
  throw new Error("Post-commit verification failed.");
}
console.log("Commit and readback verified for all 5 documents.");
