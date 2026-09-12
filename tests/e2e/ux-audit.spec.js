import { test, expect } from "@playwright/test";

const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];

test("the primary trip action stays visible without horizontal page overflow", async ({ page }) => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const button = page.getByRole("button", { name: /take me somewhere/i });
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    expect(await page.evaluate(() => document.body.scrollWidth)).toBe(viewport.width);
  }
});

test("mobile navigation stays on-screen and category choices expose selection state", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");

  for (const name of [/open journey history/i, /open saved favorites/i, /submit a site/i, /^about$/i]) {
    const item = page.getByRole(name.source.startsWith("open") ? "button" : "link", { name });
    const box = await item.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
  }

  const tinyGames = page.getByRole("button", { name: "Tiny games" });
  await tinyGames.click();
  await expect(tinyGames).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "surprise me" })).toHaveAttribute("aria-pressed", "false");
});

test("history sheet manages focus and closes with Escape", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: /open journey history/i });
  await trigger.click();

  await expect(page.getByRole("dialog", { name: /journey history/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Close panel" })).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("content pages avoid horizontal overflow and mobile form inputs do not trigger zoom", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["/about", "/submit", "/admin"]) {
    await page.goto(route);
    expect(await page.evaluate(() => document.body.scrollWidth)).toBe(390);
  }

  await page.goto("/submit");
  await expect(page.getByLabel(/website url/i)).toBeVisible();
  expect(await page.getByLabel(/website url/i).evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
  expect((await page.getByRole("button", { name: /send for review/i }).boundingBox()).height).toBeGreaterThanOrEqual(44);
});
