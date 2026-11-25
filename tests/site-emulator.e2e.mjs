import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, writeBatch } from "firebase/firestore";
import { chromium } from "playwright-core";
import { verifyPublicNavigation } from "./public-navigation.e2e.mjs";
import { verifyAdminWorkflows } from "./admin-workflows.e2e.mjs";

function loopback(value) {
  const url = new URL(value);
  assert.ok(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Local emulators only");
  return url;
}
const site = loopback(process.env.SITE_URL);
const firestore = loopback(`http://${process.env.FIRESTORE_EMULATOR_HOST}`);
const auth = loopback(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);
const projectId = process.env.GCLOUD_PROJECT;
assert.ok(projectId, "Run inside firebase emulators:exec with the project ID configured in the local build");
const env = await initializeTestEnvironment({
  projectId,
  firestore: { host: firestore.hostname, port: Number(firestore.port), rules: await readFile("firestore.rules", "utf8") },
});
const title = "합성 공개 활동";
const slug = "브라우저-검증";
const generation = "browser-fixture";
const origins = new Set([site.origin, auth.origin, firestore.origin]);
const browser = await chromium.launch({ channel: "chrome", args: ["--disable-background-networking"] });

// The Auth Emulator normally loads Google's iframe transport from a CDN.
// Relay the emulator popup's real event locally. The SDK still exchanges it with Auth Emulator.
function localFirebase({ siteOrigin, authOrigin, firestoreHost, authHost }) {
  window.__FIREBASE_DEFAULTS__ = { emulatorHosts: { auth: authHost, firestore: firestoreHost } };
  if (location.origin === authOrigin && location.pathname === "/emulator/auth/iframe") {
    window.addEventListener("message", (message) => {
      if (message.origin === authOrigin && message.data?.eventType === "sendAuthEvent") {
        parent.postMessage({ localAuthEvent: message.data.data.authEvent }, siteOrigin);
      }
    });
  }
  if (location.origin !== siteOrigin) return;
  const transport = {
    async open(options, ready) {
      const frame = document.createElement("iframe");
      frame.hidden = true;
      frame.src = options.url;
      if (new URL(frame.src).origin !== authOrigin) throw new Error("Expected local auth helper");
      const loaded = new Promise((resolve) => frame.addEventListener("load", resolve, { once: true }));
      options.where.append(frame);
      await loaded;
      return ready({
        restyle: async () => {},
        ping: async (done) => done(),
        register: (type, handle) => window.addEventListener("message", (message) => {
          if (type === "authEvent" && message.origin === authOrigin && message.source === frame.contentWindow && message.data?.localAuthEvent) {
            handle({ authEvent: message.data.localAuthEvent });
          }
        }),
        send: (type, _, reply) => {
          if (type === "webStorageSupport") {
            // GAPI dispatches callbacks asynchronously and isolates errors from the caller.
            Promise.resolve().then(() => reply([{ webStorageSupport: true }])).catch(() => {});
          }
        },
      });
    },
  };
  window.gapi = { iframes: { Iframe: true, getContext: () => transport } };
}

async function isolatedContext(options = {}) {
  const context = await browser.newContext({ ...options, serviceWorkers: "block" });
  await context.addInitScript(localFirebase, { siteOrigin: site.origin, authOrigin: auth.origin, firestoreHost: firestore.host, authHost: auth.host });
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (origins.has(url.origin)) return route.continue();
    if (url.origin === "https://www.googletagmanager.com" && url.pathname === "/gtag/js") {
      return route.fulfill({ contentType: "application/javascript", body: "/* Local analytics fixture */" });
    }
    return route.abort("blockedbyclient");
  });
  await context.routeWebSocket("**/*", (socket) => {
    if (origins.has(new URL(socket.url()).origin.replace(/^ws/, "http"))) socket.connectToServer();
    else socket.close();
  });
  context.setDefaultTimeout(35_000);
  return context;
}

try {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const batch = writeBatch(db);
    batch.delete(doc(db, "activities", slug));
    batch.delete(doc(db, "internalMetadata", "activities", "documents", slug));
    batch.set(doc(db, "generations", generation), { label: "검증 기수", published: true });
    batch.set(doc(db, "generations", "previous"), { label: "이전 기수", published: true });
    batch.set(doc(db, "members", "editor-fixture"), {
      name: "편집 검증 구성원", role: "Member", visible: false, activityGenerations: ["previous", generation],
      generationHistory: [{ generationId: "previous", role: "Team Member", position: "서버" }],
    });
    batch.set(doc(db, "members", "public-profile"), {
      name: "공개 프로필 검증", role: "Member", activityGenerations: [generation], visible: true, order: 0,
    });
    batch.set(doc(db, "projects", "legacy-browser-project"), {
      title: "탐색 검증 프로젝트", slug: "다른-프로젝트-주소", generation, summary: "탐색용", published: true,
    });
    batch.set(doc(db, "generations", "current"), { generationId: generation, label: "검증 기수", published: true });
    batch.set(doc(db, "recruitment", generation), {
      title: "검증 모집", description: "합성 공고", status: "open", published: true,
      roles: ["Member"], process: ["합성 신청 단계"], applyUrl: "https://example.test/apply",
    });
    await batch.commit();
  });

  const staff = await isolatedContext();
  const admin = await staff.newPage();
  const missingAssets = new Set();
  staff.on("response", (response) => {
    const url = new URL(response.url());
    if (response.status() === 404 && url.origin === site.origin) missingAssets.add(url.pathname);
  });
  await admin.goto(new URL("/admin/", site).href);
  const popupPromise = staff.waitForEvent("page");
  await admin.getByRole("button", { name: "Google 계정으로 로그인" }).click();
  const popup = await popupPromise;
  await popup.getByText("Add new account").click();
  await popup.locator("#email-input").fill(`archive-editor-${crypto.randomUUID()}@example.test`);
  await popup.getByRole("button", { name: /Sign in with/ }).click();
  await admin.getByRole("heading", { name: "관리 권한이 없습니다" }).waitFor();
  const uid = (await admin.locator(".admin-gate code").innerText()).split("/")[1];
  assert.ok(uid);
  await env.withSecurityRulesDisabled((context) => setDoc(doc(context.firestore(), "users", uid), { role: "editor" }));
  await admin.reload();
  const menu = admin.getByRole("navigation", { name: "관리 메뉴" });
  await menu.getByRole("button", { name: "People" }).click();
  const memberRow = admin.getByRole("row").filter({ hasText: "편집 검증 구성원" });
  await memberRow.getByRole("button", { name: "수정" }).click();
  const previousGeneration = admin.getByRole("checkbox", { name: "이전 기수" });
  await previousGeneration.uncheck();
  await previousGeneration.check();
  const historyRow = admin.locator(".generation-history-row").filter({ hasText: "이전 기수" });
  assert.equal(await historyRow.getByLabel("당시 역할").inputValue(), "Team Member");
  assert.equal(await historyRow.getByLabel("당시 담당 분야").inputValue(), "서버");
  await admin.getByRole("button", { name: "변경사항 저장" }).click();
  await memberRow.waitFor();
  await env.withSecurityRulesDisabled(async (context) => {
    const saved = await getDoc(doc(context.firestore(), "members", "editor-fixture"));
    assert.deepEqual(saved.get("generationHistory"), [{ generationId: "previous", role: "Team Member", position: "서버" }]);
  });
  await memberRow.getByRole("button", { name: "수정" }).click();
  await previousGeneration.uncheck();
  await admin.getByText(/제외/).filter({ hasText: /서버/ }).last().waitFor();
  await admin.getByRole("button", { name: "변경사항 저장" }).click();
  await memberRow.waitFor();
  await env.withSecurityRulesDisabled(async (context) => {
    const saved = await getDoc(doc(context.firestore(), "members", "editor-fixture"));
    assert.deepEqual(saved.get("activityGenerations"), [generation]);
    assert.deepEqual(saved.get("generationHistory"), []);
  });
  await menu.getByRole("button", { name: "Activities" }).click();
  await admin.getByRole("button", { name: "새 활동 추가" }).click();
  await admin.locator("#field-title").fill(title);
  await admin.locator("#field-slug").fill(slug);
  await admin.locator("#field-summary").fill("브라우저 검증용 요약");
  await admin.locator("#field-category").selectOption("Study");
  await admin.locator("#field-status").selectOption("예정");
  await admin.locator("#field-generation").selectOption(generation);
  await admin.locator("#field-published").check();
  const resourceField = admin.locator("#field-links");
  await resourceField.fill("https://example.test/old\n발표 자료 | 잘못된주소");
  await admin.getByRole("button", { name: "변경사항 저장" }).click();
  await admin.getByRole("alert").filter({ hasText: "관련 링크 2행" }).waitFor();
  await resourceField.fill("https://example.test/old\n발표 자료 | https://example.test/slides");
  const commit = (url) => url.origin === firestore.origin && url.pathname.endsWith("documents:commit");
  const gate = Promise.withResolvers();
  await admin.route(commit, async (route) => { await gate.promise; await route.continue(); });
  try {
    await Promise.all([
      admin.waitForRequest((request) => commit(new URL(request.url()))),
      admin.getByRole("button", { name: "변경사항 저장" }).click(),
    ]);
    assert.equal(await admin.locator("#field-title").isEditable(), false);
    for (const selector of ["닫기", "취소", "새 활동 추가", "로그아웃"]) {
      assert.equal(await admin.getByRole("button", { name: selector, exact: true }).isEnabled(), false, selector);
    }
    assert.equal(await menu.getByRole("button", { name: "Projects" }).isEnabled(), false);
  } finally {
    gate.resolve();
  }
  const row = admin.getByRole("row").filter({ hasText: title });
  await row.getByRole("cell", { name: "공개", exact: true }).waitFor();
  await admin.unroute(commit);
  console.log("Passed member history round trip and delayed-save editing lock");
  const guest = await isolatedContext({ hasTouch: true });
  const publicPage = await guest.newPage();
  await publicPage.goto(new URL("/activities/", site).href);
  await publicPage.getByRole("link", { name: `${title} 자세히 보기` }).click();
  await publicPage.getByRole("heading", { level: 1, name: title }).waitFor();
  assert.equal(await publicPage.getByRole("link", { name: "발표 자료" }).getAttribute("href"), "https://example.test/slides");
  assert.equal(await publicPage.getByRole("link", { name: "example.test/old" }).getAttribute("href"), "https://example.test/old");
  await verifyPublicNavigation({
    guest, site, generation, activityTitle: title,
    setProjectPublished: (published) => env.withSecurityRulesDisabled((context) =>
      setDoc(doc(context.firestore(), "projects", "legacy-browser-project"), { published }, { merge: true })),
  });
  await verifyAdminWorkflows({ admin, firestore, title, generation });
  admin.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "보관", exact: true }).click();
  await row.getByRole("cell", { name: "보관됨" }).waitFor();
  assert.equal(await row.getByRole("button", { name: "수정" }).count(), 0);
  await publicPage.reload();
  await publicPage.getByRole("heading", { name: "콘텐츠를 찾을 수 없습니다" }).waitFor();
  await row.getByRole("button", { name: "복원" }).click();
  await row.getByRole("cell", { name: "비공개", exact: true }).waitFor();
  await publicPage.reload();
  await publicPage.getByRole("heading", { name: "콘텐츠를 찾을 수 없습니다" }).waitFor();
  console.log("Passed Google emulator sign-in, denied/editor roles, public create, detail navigation, archive and private restore");

  const roleRetry = await staff.newPage();
  const firestoreRequests = `${firestore.origin}/**/*`;
  await roleRetry.route(firestoreRequests, (route) => route.abort("internetdisconnected"));
  await roleRetry.goto(new URL("/admin/", site).href);
  await roleRetry.getByRole("heading", { name: "권한을 확인하지 못했습니다" }).waitFor();
  await roleRetry.unroute(firestoreRequests);
  await staff.setOffline(true);
  await staff.setOffline(false);
  await roleRetry.getByRole("button", { name: "권한 다시 확인" }).click();
  await roleRetry.getByRole("navigation", { name: "관리 메뉴" }).waitFor();
  await roleRetry.close();
  console.log("Passed role lookup retry with the existing signed-in account");

  const recruit = await guest.newPage();
  let disconnected = true;
  await recruit.route(`${firestore.origin}/**/*`, (route) => disconnected ? route.abort("internetdisconnected") : route.fallback());
  await recruit.goto(new URL("/recruit/", site).href);
  await recruit.getByRole("heading", { level: 1, name: "모집 안내" }).waitFor();
  const retry = recruit.getByRole("button", { name: "다시 시도" });
  await retry.waitFor();
  assert.equal(await retry.count(), 1);
  disconnected = false;
  await guest.setOffline(true);
  await guest.setOffline(false);
  await retry.click();
  await recruit.getByRole("heading", { level: 1, name: "검증 모집" }).waitFor();
  await recruit.getByRole("heading", { name: "Member", exact: true }).waitFor();
  await recruit.getByText("합성 신청 단계", { exact: true }).waitFor();
  assert.equal(await recruit.getByRole("link", { name: /지원하기/ }).getAttribute("href"), "https://example.test/apply");
  assert.equal(await retry.count(), 0);
  console.log("Passed recruitment loading/error H1, one retry and recovery of the same announcement, role and process");
  assert.equal(await recruit.locator("header nav [aria-current=page]:visible").count(), 1);

  const updateRecruitment = (changes) => env.withSecurityRulesDisabled((context) =>
    setDoc(doc(context.firestore(), "recruitment", generation), changes, { merge: true }));
  await updateRecruitment({ endDate: "2030-09-12", endTime: "18:00" });
  const timedGuest = await isolatedContext();
  const timedRecruit = await timedGuest.newPage();
  await timedRecruit.clock.install({ time: new Date("2030-09-12T17:50:00+09:00") });
  const timedHome = await timedGuest.newPage();
  await Promise.all([
    timedRecruit.goto(new URL("/recruit/", site).href),
    timedHome.goto(site.href),
  ]);
  for (const page of [timedHome, timedRecruit]) {
    const panel = page.locator(".recruitment-panel");
    await panel.getByText("모집 중", { exact: true }).waitFor();
    await panel.getByText("접수 마감 2030-09-12 18:00 (한국시간)").waitFor();
    assert.equal(await panel.getByRole("link", { name: "지원하기" }).getAttribute("href"), "https://example.test/apply");
  }
  await timedRecruit.clock.fastForward(10 * 60_000);
  for (const page of [timedHome, timedRecruit]) {
    const panel = page.locator(".recruitment-panel");
    await panel.getByText("모집 종료", { exact: true }).waitFor();
    assert.equal(await panel.getByRole("link", { name: "지원하기" }).count(), 0);
  }
  await timedHome.locator(".recruitment-panel").getByRole("link", { name: "모집 안내" }).click();
  await timedHome.getByRole("heading", { level: 1, name: "검증 모집" }).waitFor();
  await updateRecruitment({ endTime: "" });
  await timedRecruit.reload();
  await timedRecruit.getByRole("link", { name: "지원하기" }).waitFor();
  await updateRecruitment({ status: "closed" });
  await timedRecruit.reload();
  await timedRecruit.getByText("모집 종료", { exact: true }).waitFor();
  assert.equal(await timedRecruit.getByRole("link", { name: "지원하기" }).count(), 0);
  await updateRecruitment({ published: false });
  await timedRecruit.reload();
  await timedRecruit.getByText("현재 모집 없음", { exact: true }).waitFor();
  assert.equal(await timedRecruit.getByRole("heading", { name: "모집 역할" }).count(), 0);
  assert.equal(await timedRecruit.getByRole("heading", { name: "지원부터 합류까지" }).count(), 0);
  await timedGuest.close();
  console.log("Passed timed cutoff on open home and recruitment tabs, legacy dates, manual close and a single empty notice");
  const first = await guest.newPage();
  const second = await guest.newPage();
  for (const tab of [first, second]) await tab.goto(new URL("/privacy/", site).href);
  const settings = first.locator("#analytics-settings");
  await settings.getByRole("button", { name: "동의" }).click();
  await second.locator("#analytics-settings").getByText("현재 선택: 동의").waitFor();
  await second.waitForFunction(() => window.dataLayer?.some((event) => event[1] === "page_view"));
  await settings.getByRole("button", { name: "거부" }).click();
  await settings.getByText("현재 선택: 거부").waitFor();
  await second.locator("#analytics-settings").getByText("현재 선택: 거부").waitFor();
  assert.ok(await second.evaluate(() => Object.keys(window).some((key) => key.startsWith("ga-disable-G-") && window[key] === true)));
  await settings.getByRole("button", { name: "동의" }).click();
  await settings.getByText("현재 선택: 동의").waitFor();
  const timeOrigin = await first.evaluate(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "gdgoc-analytics-consent") throw new DOMException("Fixture", "QuotaExceededError");
      return set.call(this, key, value);
    };
    return performance.timeOrigin;
  });
  await settings.getByRole("button", { name: "거부" }).click();
  await settings.getByText("현재 선택: 거부").waitFor();
  await settings.getByRole("status").filter({ hasText: "이 탭에서만 적용" }).waitFor();
  assert.equal(await first.evaluate(() => performance.timeOrigin), timeOrigin);
  console.log("Passed active navigation, analytics opt-out across tabs, and denied storage writes without reload");
  assert.deepEqual([...missingAssets], [], "Local navigation assets should resolve");
} finally {
  await browser.close();
  await env.cleanup();
}
