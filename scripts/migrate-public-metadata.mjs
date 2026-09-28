import { sign } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { pathToFileURL } from "node:url";

const collections = ["members", "activities", "projects", "recruitment", "generations"];
const privateFields = ["createdBy", "updatedBy", "archivedBy", "consentConfirmedAt", "consentConfirmedBy"];

export function planDocument(document, metadata, collection) {
  const fields = document.fields || {};
  const existing = metadata?.fields || {};
  const moved = Object.fromEntries(privateFields.filter((field) => field in fields).map((field) => [field, fields[field]]));
  const combined = { ...existing, ...moved };
  const issues = [];
  for (const [field, value] of Object.entries(existing)) {
    if (!privateFields.includes(field)) issues.push("unknown-metadata-field");
    if (field in moved && !isDeepStrictEqual(value, moved[field])) issues.push("metadata-conflict");
  }
  for (const [field, value] of Object.entries(combined)) {
    if (field === "consentConfirmedAt" ? typeof value.timestampValue !== "string" : typeof value.stringValue !== "string") issues.push("invalid-metadata-type");
    if (collection !== "members" && field.startsWith("consentConfirmed")) issues.push("non-member-consent");
  }
  if (collection === "members" && fields.visible?.booleanValue === true
    && !(typeof combined.consentConfirmedAt?.timestampValue === "string" && typeof combined.consentConfirmedBy?.stringValue === "string")) {
    issues.push("visible-member-missing-consent");
  }
  return {
    moved,
    publicFields: Object.fromEntries(Object.entries(fields).filter(([field]) => !privateFields.includes(field))),
    metadataFields: combined,
    issues: [...new Set(issues)],
  };
}

export function migrationWrites(document, metadata, metadataName, plan) {
  return [
    {
      update: { name: metadataName, fields: plan.metadataFields },
      currentDocument: metadata ? { updateTime: metadata.updateTime } : { exists: false },
    },
    {
      update: { name: document.name, fields: plan.publicFields },
      currentDocument: { updateTime: document.updateTime },
    },
  ];
}

async function main() {
  const mode = process.env.MIGRATION_MODE || "dry-run";
  if (!(["dry-run", "apply"].includes(mode))) throw new Error("MIGRATION_MODE must be dry-run or apply");
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "null");
  const project = process.env.FIREBASE_PROJECT_ID;
  if (!serviceAccount?.private_key || !serviceAccount?.client_email || !project || serviceAccount.project_id !== project) {
    throw new Error("Service account and FIREBASE_PROJECT_ID must match");
  }

  const now = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const assertionBody = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = sign("RSA-SHA256", Buffer.from(assertionBody), serviceAccount.private_key).toString("base64url");
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${assertionBody}.${signature}` }),
  });
  if (!tokenResponse.ok) throw new Error(`OAuth token request failed: HTTP ${tokenResponse.status}`);
  const { access_token: token } = await tokenResponse.json();
  if (!token) throw new Error("OAuth token response was empty");

  const database = `projects/${project}/databases/(default)`;
  const root = `https://firestore.googleapis.com/v1/${database}/documents`;
  async function request(url, options = {}) {
    const response = await fetch(url, { ...options, headers: { authorization: `Bearer ${token}`, ...(options.body ? { "content-type": "application/json" } : {}) } });
    if (response.status === 404 && options.missingOk) return null;
    if (!response.ok) throw new Error(`Firestore request failed: HTTP ${response.status}`);
    return response.json();
  }

  async function scan() {
    const entries = [];
    const summary = [];
    for (const collection of collections) {
      let pageToken = "";
      let documents = 0;
      let toMove = 0;
      const issues = {};
      do {
        const url = new URL(`${root}/${collection}`);
        url.searchParams.set("pageSize", "1000");
        if (pageToken) url.searchParams.set("pageToken", pageToken);
        const page = await request(url);
        for (const document of page.documents || []) {
          documents++;
          const id = document.name.slice(document.name.lastIndexOf("/") + 1);
          const metadataName = `${database}/documents/internalMetadata/${collection}/documents/${id}`;
          const metadata = await request(`https://firestore.googleapis.com/v1/${metadataName}`, { missingOk: true });
          const plan = planDocument(document, metadata, collection);
          if (Object.keys(plan.moved).length) toMove++;
          for (const issue of plan.issues) issues[issue] = (issues[issue] || 0) + 1;
          entries.push({ document, metadata, metadataName, plan });
        }
        pageToken = page.nextPageToken || "";
      } while (pageToken);
      summary.push({ collection, documents, toMove, issues });
    }
    return { entries, summary };
  }

  const before = await scan();
  console.log(JSON.stringify({ mode, summary: before.summary }));
  if (before.summary.some((item) => Object.keys(item.issues).length)) throw new Error("Preflight found conflicts or missing consent; nothing was changed");
  if (mode === "dry-run") return;

  let movedCount = 0;
  for (const { document, metadata, metadataName, plan } of before.entries) {
    if (!Object.keys(plan.moved).length) continue;
    const writes = migrationWrites(document, metadata, metadataName, plan);
    await request(`${root}:commit`, { method: "POST", body: JSON.stringify({ writes }) });
    movedCount++;
  }
  const after = await scan();
  if (after.summary.some((item) => item.toMove || Object.keys(item.issues).length)) throw new Error(`Postflight failed after ${movedCount} atomic document migrations`);
  console.log(JSON.stringify({ migratedDocuments: movedCount, postflight: after.summary }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
