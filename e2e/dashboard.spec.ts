import { expect, test } from "@playwright/test";

test("六站首頁預設珠海並可切換深圳", async ({ page }, testInfo) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "粵港六站油價及油卡比價" })).toBeVisible();
  await expect(page.getByLabel("全域大陸城市")).toHaveValue("zhuhai");
  if (testInfo.project.name === "mobile") {
    await expect(page.getByText("手機版 · 最抵三強")).toBeVisible();
    await expect(page.getByText("電腦版 · 六站總覽")).toBeHidden();
    await expect(page.locator(".station-card")).toHaveCount(3);
    const toggle = page.locator('button[aria-controls="station-results"]');
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(page.locator(".station-card")).toHaveCount(6);
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await page.evaluate(() => window.scrollTo(0, 500));
    const sticky = page.locator(".sticky-summary");
    await expect(sticky).toBeVisible();
    await expect(sticky).toContainText(/HK\$\d+\.\d{2}/);
  } else {
    await expect(page.getByText("電腦版 · 六站總覽")).toBeVisible();
    await expect(page.getByText("手機版 · 最抵三強")).toBeHidden();
    await expect(page.locator(".station-card")).toHaveCount(6);
  }

  await page.getByLabel("全域大陸城市").selectOption("shenzhen");
  await expect(page.locator(".station-card")).not.toHaveCount(0);
  await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).resolves.toBeTruthy();
});

test("廣東中石化可獨立覆寫城市並打開詳情", async ({ page }, testInfo) => {
  await page.goto("./");
  if (testInfo.project.name === "mobile") {
    await page.evaluate(() => window.scrollTo(0, 500));
    await expect(page.locator(".sticky-summary")).toBeVisible();
  }
  const card = page.locator(".station-card").filter({ hasText: "廣東中石化" });
  await card.getByRole("button", { name: "廣東中石化詳情" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(page.locator(".sticky-summary")).toHaveCount(0);
  if (testInfo.project.name === "mobile") {
    await expect(page.locator(".sheet-handle")).toBeVisible();
    const viewport = page.viewportSize()!;
    await expect
      .poll(async () => {
        const box = await dialog.boundingBox();
        return box ? Math.abs(box.y + box.height - viewport.height) : 999;
      })
      .toBeLessThan(3);
  } else {
    await expect(page.locator(".sheet-handle")).toBeHidden();
    const viewport = page.viewportSize()!;
    await expect
      .poll(async () => {
        const box = await dialog.boundingBox();
        return box
          ? Math.abs(box.y + box.height / 2 - viewport.height / 2)
          : 999;
      })
      .toBeLessThan(12);
  }
  await dialog.getByLabel("大陸城市").selectOption("shenzhen");
  await dialog.getByRole("button", { name: "關閉" }).click();
  const updatedCard = page.locator(".station-card").filter({ hasText: "廣東中石化" });
  await expect(updatedCard).toContainText("已自訂 · 深圳");
  await expect(updatedCard).toContainText("城市快照");
});

test("日期變更會自動重新校準優惠", async ({ page }, testInfo) => {
  await page.goto("./");
  const automatic = page.getByRole("checkbox", { name: "自動今日" });
  const initialDate = await page.getByLabel("加油日期").inputValue();
  await expect(automatic).toBeChecked();
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "查看其餘 3 站" }).click();
  }
  await page.getByLabel("加油日期").fill("2026-11-18");
  await expect(automatic).not.toBeChecked();
  await expect(
    page.locator(".station-card").filter({ hasText: "香港中石油" }),
  ).toContainText("星期三直減");
  await expect(
    page.locator(".station-card").filter({ hasText: "香港中石化" }),
  ).toContainText("星期三升級優惠");
  await expect(
    page.locator(".station-card").filter({ hasText: "廣東 Shell" }),
  ).toContainText("日期優惠取較大");
  await automatic.check();
  await expect(automatic).toBeChecked();
  await expect(page.getByLabel("加油日期")).toHaveValue(initialDate);
});

test("經典路由與 reduced motion 可用", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./?view=classic");
  await expect(page.getByRole("heading", { name: "香港加德士 × 廣東 Shell" })).toBeVisible();
  await expect(page.locator(".station-card")).toHaveCount(2);
});
