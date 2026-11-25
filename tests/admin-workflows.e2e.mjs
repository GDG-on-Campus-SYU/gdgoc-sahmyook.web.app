import assert from "node:assert/strict";

export async function verifyAdminWorkflows({ admin, firestore, title, generation }) {
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(firestore.hostname));
  const menu = admin.getByRole("navigation", { name: "관리 메뉴" });
  const button = (name) => admin.getByRole("button", { name, exact: true });
  const go = (name) => menu.getByRole("button", { name, exact: true }).click();
  const row = (name) => admin.getByRole("row").filter({ has: admin.getByText(name, { exact: true }) });
  const edit = (name) => row(name).getByRole("button", { name: "수정", exact: true });
  const collections = [
    ["Activities", title, "title"], ["Projects", "탐색 검증 프로젝트", "title"],
    ["People", "편집 검증 구성원", "name"], ["Recruit", "검증 모집", "title"],
    ["Generations", "검증 기수", "label"],
  ];

  for (const width of [320, 390, 768, 1440]) {
    await admin.setViewportSize({ width, height: 844 });
    for (const [collection, item, field] of collections) {
      await go(collection);
      const trigger = edit(item);
      await trigger.waitFor();
      const bounds = await trigger.boundingBox();
      assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width + 1, `${collection} edit at ${width}px`);
      assert.ok(await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${collection} overflow at ${width}px`);
      const focusKey = await trigger.getAttribute("data-focus-key");
      await trigger.click();
      await admin.waitForFunction((id) => document.activeElement?.id === id, `field-${field}`);
      assert.ok(await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${collection} form overflow at ${width}px`);
      if (width === 1440) {
        if (collection === "Projects") {
          const commit = (url) => url.origin === firestore.origin && url.pathname.endsWith("documents:commit");
          const summary = admin.locator("#field-summary");
          const draft = "저장 실패 후 복구할 합성 소개";
          await summary.fill(draft);
          await admin.route(commit, (route) => route.request().method() === "POST" ? route.fulfill({
            status: 403, contentType: "application/json",
            headers: { "access-control-allow-origin": new URL(admin.url()).origin },
            body: JSON.stringify({ error: { code: 403, status: "PERMISSION_DENIED", message: "Simulated form submission failure" } }),
          }) : route.fallback());
          try {
            await button("변경사항 저장").click();
            await admin.getByRole("alert").filter({ hasText: "저장하지 못했습니다" }).waitFor();
            assert.equal(await summary.inputValue(), draft);
            assert.equal(await summary.isEditable(), true);
          } finally {
            await admin.unroute(commit);
          }
        }
        await button("변경사항 저장").click();
        await admin.getByText("저장했습니다.", { exact: true }).waitFor();
        if (collection === "Projects") {
          const href = await admin.getByRole("link", { name: /저장한 공개본 보기/ }).getAttribute("href");
          const url = new URL(href, admin.url());
          assert.equal(url.searchParams.get("id"), "legacy-browser-project");
          assert.equal(url.searchParams.get("slug"), "다른-프로젝트-주소");
        }
      } else {
        await button("취소").click();
      }
      await admin.waitForFunction((key) => document.activeElement?.dataset.focusKey === key, focusKey);
    }
  }

  await go("Generations");
  assert.equal(await row("검증 기수").getByRole("button", { name: "보관" }).count(), 0);
  await edit("검증 기수").click();
  assert.equal(await admin.locator("#field-published").isDisabled(), true);
  await button("취소").click();
  await row("이전 기수").getByRole("button", { name: "현재로 설정" }).click();
  await row("이전 기수").getByText("현재", { exact: true }).waitFor();
  await go("Recruit");
  await button("새 모집 추가").click();
  assert.equal(await admin.locator(".admin-form input[readonly]").inputValue(), "previous");
  await button("취소").click();
  await go("Generations");
  await row("검증 기수").getByRole("button", { name: "현재로 설정" }).click();
  await row("검증 기수").getByText("현재", { exact: true }).waitFor();
  await go("Recruit");
  await button("현재 기수 모집 수정").click();
  assert.equal(await admin.locator("#field-title").inputValue(), "검증 모집");
  await button("취소").click();
  admin.once("dialog", (dialog) => dialog.accept());
  await row("검증 모집").getByRole("button", { name: "보관" }).click();
  await button("현재 기수 모집 복원").click();
  await button("현재 기수 모집 수정").click();
  assert.equal(await admin.locator("#field-published").isChecked(), false);
  await admin.locator("#field-published").check();
  await button("변경사항 저장").click();
  await row("검증 모집").getByRole("cell", { name: "공개", exact: true }).waitFor();

  const context = admin.context();
  try {
    await context.setOffline(true);
    await go("Projects");
    const listRetry = button("목록 다시 시도");
    await listRetry.waitFor();
    assert.equal(await admin.getByRole("heading", { name: /등록된.*없습니다/ }).count(), 0);
    await context.setOffline(false);
    await listRetry.click();
    await edit("탐색 검증 프로젝트").waitFor();
    await context.setOffline(true);
    await button("새 프로젝트 추가").click();
    await admin.locator("#field-title").fill("복구할 입력");
    const optionsRetry = button("기수 목록 다시 시도");
    await optionsRetry.waitFor();
    await context.setOffline(false);
    await optionsRetry.click();
    await admin.locator("#field-generation").selectOption(generation);
    assert.equal(await admin.locator("#field-title").inputValue(), "복구할 입력");
    admin.once("dialog", (dialog) => dialog.accept());
    await button("취소").click();
  } finally {
    await context.setOffline(false);
  }
  await go("Activities");
  await edit(title).waitFor();
  assert.equal(await admin.getByRole("searchbox").inputValue(), "");
  console.log("Passed 20 responsive admin list/form checks, focus recovery, recruitment and generation actions, list and option retries");
}
