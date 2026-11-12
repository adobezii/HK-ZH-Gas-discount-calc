import { expect, test } from "@playwright/test";

test("六站首頁預設珠海並可切換深圳", async ({ page }, testInfo) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "粵港六站油價及油卡比價" })).toBeVisible();
  await expect(page.getByLabel("全域大陸城市")).toHaveValue("zhuhai");
  if (testInfo.project.name === "mobile") {
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
  await dialog.getByLabel("大陸城市").selectOption("shenzhen");
  await dialog.getByRole("button", { name: "關閉" }).click();
  const updatedCard = page.locator(".station-card").filter({ hasText: "廣東中石化" });
  await expect(updatedCard).toContainText("已自訂 · 深圳");
  await expect(updatedCard).toContainText("城市快照");
});

test("經典路由與 reduced motion 可用", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./?view=classic");
  await expect(page.getByRole("heading", { name: "香港加德士 × 廣東 Shell" })).toBeVisible();
  await expect(page.locator(".station-card")).toHaveCount(2);
});
