import assert from "node:assert/strict";

export async function verifyPublicNavigation({ guest, site, generation, activityTitle, setProjectPublished }) {
  const page = await guest.newPage();
  const open = (path) => page.goto(new URL(path, site).href);
  async function checkFirstScreen(locator) {
    await locator.waitFor();
    await page.evaluate(() => document.fonts.ready);
    const visible = await locator.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return rect.top >= 0 && rect.bottom <= window.innerHeight && element.contains(hit);
    });
    assert.ok(visible, `Expected ${await locator.textContent()} in the unobstructed first screen`);
  }
  try {
    await page.setViewportSize({ width: 320, height: 640 });
    await open("/");
    const activities = page.getByRole("link", { name: "활동 보기", exact: true });
    await page.getByRole("region", { name: "방문 분석 설정" }).waitFor();
    await checkFirstScreen(activities);
    const smallAction = await activities.boundingBox();
    const banner = await page.getByRole("region", { name: "방문 분석 설정" }).boundingBox();
    assert.ok(smallAction.y + smallAction.height <= banner.y, "First-visit banner overlaps the activity link");
    console.log(`320×640 CSS px: activity link y=${Math.round(smallAction.y)}–${Math.round(smallAction.y + smallAction.height)}, banner y=${Math.round(banner.y)}`);
    await activities.tap();
    await page.getByRole("heading", { level: 1, name: "배우고, 시도하고, 함께 남긴 기록" }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await open("/");
    await page.getByRole("region", { name: "방문 분석 설정" }).waitFor();
    await checkFirstScreen(activities);
    const homeCard = page.locator(".activity-card").first();
    await homeCard.waitFor();
    const activityTop = Math.round((await homeCard.boundingBox()).y);
    const actionTop = Math.round((await activities.boundingBox()).y);
    await activities.tap();
    const card = page.getByRole("link", { name: `${activityTitle} 자세히 보기` });
    await card.waitFor();
    await page.getByRole("button", { name: "거부", exact: true }).click();
    const category = page.getByRole("combobox", { name: "활동 카테고리" });
    const officialEvents = await page.locator(".chapter-event-list a").count();
    assert.ok(officialEvents > 0);
    await category.selectOption("Hackathon");
    await page.getByText("활동 0건", { exact: true }).waitFor();
    assert.equal(await page.locator(".chapter-event-list a").count(), officialEvents);
    await page.getByRole("button", { name: "필터 초기화" }).press("Enter");
    await card.waitFor();
    assert.equal(new URL(page.url()).search, "");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("role")), "status");
    await page.getByRole("combobox", { name: "활동 기수" }).selectOption(generation);
    await category.selectOption("Study");
    await card.click();
    await page.getByRole("heading", { level: 1, name: activityTitle }).waitFor();
    await page.goBack();
    await card.waitFor();
    assert.equal(await category.inputValue(), "Study");
    await card.click();
    await page.getByRole("heading", { level: 1, name: activityTitle }).waitFor();
    await page.getByRole("link", { name: "← 활동 목록" }).click();
    await card.waitFor();
    assert.equal(await category.inputValue(), "Study");
    const sharedList = page.url();
    await page.reload();
    await card.waitFor();
    assert.equal(await page.getByRole("combobox", { name: "활동 기수" }).inputValue(), generation);
    assert.equal(new URL(sharedList).searchParams.get("category"), "Study");

    await setProjectPublished(false);
    try {
      await open("/");
      await page.locator(".home-projects .compact-empty").waitFor();
      assert.equal(await page.locator(".home-projects").getByRole("link").count(), 0);
      await open("/projects/");
      const empty = page.locator("main .empty-state");
      await empty.getByRole("heading", { name: "아직 공개된 프로젝트가 없습니다" }).waitFor();
      await empty.getByRole("link", { name: "챕터 활동 보기" }).click();
      await card.waitFor();
    } finally {
      await setProjectPublished(true);
    }
    await open("/");
    const projects = page.locator(".home-projects");
    await projects.getByRole("heading", { name: "탐색 검증 프로젝트" }).waitFor();
    await projects.getByRole("link", { name: "모든 프로젝트" }).click();
    const projectGeneration = page.getByRole("combobox", { name: "프로젝트 기수" });
    await projectGeneration.selectOption("previous");
    await page.getByText("프로젝트 0건", { exact: true }).waitFor();
    await page.getByRole("button", { name: "필터 초기화" }).click();
    await projectGeneration.selectOption(generation);
    await page.getByRole("link", { name: "탐색 검증 프로젝트 프로젝트 보기" }).click();
    await page.getByRole("heading", { level: 1, name: "탐색 검증 프로젝트" }).waitFor();
    assert.equal(new URL(page.url()).searchParams.get("id"), "legacy-browser-project");
    await page.getByRole("link", { name: "← 프로젝트 목록" }).click();
    await projectGeneration.waitFor();
    assert.equal(await projectGeneration.inputValue(), generation);

    await open("/people/");
    const profile = page.getByRole("heading", { name: "공개 프로필 검증" });
    await checkFirstScreen(profile);
    const filterTop = Math.round((await page.getByRole("combobox", { name: "활동 기수" }).boundingBox()).y);
    const profileTop = Math.round((await profile.boundingBox()).y);
    const profileCardTop = Math.round((await page.locator(".person-card").filter({ has: profile }).boundingBox()).y);
    console.log(`390×844 CSS px, local fixtures: home with first-visit banner — activity link y=${actionTop}, card y=${activityTop}; people after declining banner — filter y=${filterTop}, profile card y=${profileCardTop}, name y=${profileTop}`);
    await open("/about/");
    const disclosure = page.locator(".mobile-nav");
    const trigger = disclosure.locator("summary");
    await trigger.focus();
    await page.keyboard.press("Enter");
    await disclosure.getByRole("link").last().focus();
    await page.keyboard.press("Tab");
    assert.equal(await disclosure.getAttribute("open"), null);
    await trigger.tap();
    const menuBox = await disclosure.getByRole("navigation").boundingBox();
    assert.ok(menuBox && menuBox.x > 0);
    await page.touchscreen.tap(menuBox.x / 2, menuBox.y + 10);
    assert.equal(await disclosure.getAttribute("open"), null);
    await trigger.click();
    await disclosure.getByRole("link").first().focus();
    await page.keyboard.press("Escape");
    assert.equal(await disclosure.getAttribute("open"), null);
    assert.equal(await trigger.evaluate((node) => document.activeElement === node), true);
    await trigger.click();
    await disclosure.getByRole("link", { name: "Projects" }).click();
    await page.getByRole("heading", { level: 1, name: "문제에서 시작해, 작동하는 결과물까지" }).waitFor();
    assert.equal(await disclosure.getAttribute("open"), null);

    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await open(sharedList);
      await card.waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `activity list overflow at ${width}`);
      assert.equal(await card.isVisible(), true);
    }
    assert.equal(await page.locator(".desktop-nav").getByRole("link", { name: "모집 안내" }).count(), 1);
    const response = await open("/missing-public-navigation-fixture/");
    assert.equal(response.status(), 404);
    await page.getByRole("heading", { name: "페이지를 찾을 수 없습니다" }).waitFor();
    await page.getByRole("main").getByRole("link", { name: "활동 목록" }).click();
    await card.waitFor();
    console.log("Passed archive filters and return links, mobile entry points and menu, four viewport widths, and Hosting 404 recovery");
  } finally {
    await page.close();
  }
}
