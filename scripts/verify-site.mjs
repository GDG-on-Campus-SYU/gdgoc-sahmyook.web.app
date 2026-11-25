import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright-core";

const base = new URL(process.env.SITE_URL);
const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(25_000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  async function open(path) {
    const response = await page.goto(new URL(path, base).href, { waitUntil: "domcontentloaded" });
    assert.equal(response?.status(), 200, path);
  }
  async function ready(selector) {
    await page.locator(`${selector}, main [role="alert"]`).first().waitFor();
    assert.equal(await page.locator('main [role="alert"]').count(), 0, `Data failed on ${new URL(page.url()).pathname}`);
  }

  await open("/");
  const expected = await readFile("out/index.html", "utf8");
  const chunks = [...expected.matchAll(/<script\b[^>]*\bsrc="([^"]*\/_next\/static\/[^"]+\.js)"/g)].map(([, src]) => src);
  assert.ok(chunks.length > 0, "The release build must contain JS assets");
  const hosted = await page.locator("script[src]").evaluateAll((scripts) => scripts.map((node) => node.getAttribute("src")));
  assert.ok(chunks.every((src) => hosted.includes(src)), "The deployed home page references a different build");
  await ready(".recruitment-panel .status-badge");

  for (const [path, card, heading] of [
    ["/activities/", ".activity-card", "배우고, 시도하고, 함께 남긴 기록"],
    ["/projects/", ".project-card", "문제에서 시작해, 작동하는 결과물까지"],
    ["/people/", ".person-card", "커뮤니티를 만드는 사람들"],
  ]) {
    await open(path);
    await page.getByRole("heading", { level: 1, name: heading, exact: true }).waitFor();
    await ready(`main ${card}, main .empty-state`);
    const first = page.locator(card).first();
    if (card === ".person-card" || !(await first.count())) continue;
    const title = await first.getByRole("heading").innerText();
    await first.locator('a[href*="/detail/"]').click();
    await page.getByRole("heading", { level: 1, name: title, exact: true }).waitFor();
  }
  await open("/recruit/");
  await ready(".recruitment-panel .status-badge");
  assert.equal(await page.locator("main h1").count(), 1);
  await open("/admin/");
  await page.getByRole("button", { name: "Google 계정으로 로그인" }).waitFor();
  const missing = await page.goto(new URL("/missing-site-verification-page/", base).href);
  assert.equal(missing?.status(), 404);
  await page.getByRole("heading", { name: "페이지를 찾을 수 없습니다" }).waitFor();
  await page.getByRole("main").getByRole("link", { name: "활동 목록" }).click();
  await ready("main .activity-card, main .empty-state");
  assert.deepEqual(errors, []);
  console.log("Verified release assets, collections, detail links, recruitment, admin login and 404 recovery");
} finally {
  await browser.close();
}
