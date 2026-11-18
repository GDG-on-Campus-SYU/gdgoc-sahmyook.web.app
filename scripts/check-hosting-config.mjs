// The developer build also supports a deliberately disconnected preview.
const required = [
  "NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID", "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID", "NEXT_PUBLIC_SITE_URL", "FIREBASE_PROJECT_ID",
];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) throw new Error(`Missing Hosting configuration: ${missing.join(", ")}`);
if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== process.env.FIREBASE_PROJECT_ID) {
  throw new Error("The public Firestore project differs from the Hosting deploy target");
}
const site = new URL(process.env.NEXT_PUBLIC_SITE_URL);
if (site.protocol !== "https:" || site.href !== site.origin + "/") {
  throw new Error("NEXT_PUBLIC_SITE_URL must be an HTTPS origin");
}
