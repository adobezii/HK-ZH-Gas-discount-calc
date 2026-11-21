import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("https://hkg-deadline.github.io/**", async (route) => {
    if (!route.request().url().endsWith("petrolprice.json")) return route.fulfill({ json: {} });
    return route.fulfill({ json: [
      { type: "Standard Petrol", price: { Shell: "34.52", Caltex: "34.72" } },
      { type: "Premium Petrol", price: { Shell: "34.52", Caltex: "36.52" } },
    ] });
  });
  await page.route("https://open.er-api.com/**", (route) => route.fulfill({ json: { base_code: "CNY", rates: { HKD: 1.08 } } }));
});

test("三站首頁、車款捷徑、手機固定摘要及單頁 PDF", async ({ page }, testInfo) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "粵港三站油價比價" })).toBeVisible();
  await expect(page.locator(".station-card")).toHaveCount(3);
  await expect(page.getByRole("button", { name: /中石化|中石油/ })).toHaveCount(0);
  await page.getByRole("button", { name: /大霸王/ }).click();
  await expect(page.getByLabel("入油升數（L）")).toHaveValue("65");
  await page.getByLabel("計入來回路費 ¥285").uncheck();
  await expect(page.locator(".decision")).toContainText("未計路費");
  const sticky = page.locator(".sticky-summary");
  if (testInfo.project.name === "desktop") await expect(sticky).toBeHidden();
  else {
    await expect(sticky).toBeVisible();
    await expect(sticky.locator("strong")).toHaveCount(3);
    await page.getByLabel("入油升數（L）").focus();
    await expect(sticky).toBeHidden();
  }
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= visualViewport!.width)).toBe(true);
  await expect(page.locator('meta[name="viewport"]')).not.toHaveAttribute("content", /maximum-scale|user-scalable=no/);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".print-summary")).toContainText("珠海不計路費");
  await expect(page.locator(".station-card").first()).toBeHidden();
  if (testInfo.project.name === "desktop") {
    const pdf = await page.pdf({ preferCSSPageSize: true });
    expect(pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
  }
});

test("油品切換、券數反算與珠海快捷鍵各自更新", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "香港 Shell V-Power詳情" }).click();
  let dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Shell 牌價")).toHaveValue("36.32");
  await dialog.getByRole("button", { name: "FuelSave" }).click();
  await expect(dialog.getByLabel("Shell 牌價")).toHaveValue("34.52");
  await dialog.getByRole("button", { name: "V-Power" }).click();
  await expect(dialog.getByLabel("Shell 牌價")).toHaveValue("36.32");
  await dialog.getByRole("button", { name: "關閉" }).click();
  await page.getByRole("button", { name: "香港加德士白金詳情" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("入油目標").selectOption("coupons");
  await dialog.getByLabel("張數").fill("2");
  await dialog.getByRole("button", { name: "套用升數" }).click();
  await expect(dialog.getByRole("status")).toHaveText("已套用 19.17 L");
  await dialog.getByLabel("加德士油券算法").click();
  await expect(dialog.getByText(/並非在卡後金額/)).toBeVisible();
  await dialog.getByRole("button", { name: "關閉" }).click();
  await page.getByLabel("加油日期").fill("2026-11-28");
  await expect(page.locator(".station-card").filter({ hasText: "珠海 Shell" })).toContainText("日期優惠取較大");
  await page.getByRole("button", { name: "珠海 Shell 98#詳情" }).click();
  dialog = page.getByRole("dialog");
  const price = dialog.getByLabel("廣東 Shell 98# 牌價");
  await price.fill("12.34");
  await dialog.getByRole("button", { name: /週三／六減/ }).click();
  await expect(price).toHaveValue("12.34");
});

test("經典路由與淺色主題可用", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  await page.goto("./?view=classic");
  await expect(page.getByRole("heading", { name: "香港加德士 × 廣東 Shell" })).toBeVisible();
  await expect(page.locator(".station-card")).toHaveCount(2);
  await page.getByRole("button", { name: "切換至淺色主題" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
