import { test, expect } from "@playwright/test";

const fixture = { id: "11111111-1111-4111-8111-111111111111", url: "https://example.com/tms", title: "A Very Odd Portal", description: "A test portal for curious travelers.", category: "weird-web", tags: ["test"], weirdness: 4 };

test.beforeEach(async ({ context }) => {
  await context.route("**/api/destinations/random", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ destination: fixture, repeated: false }) }));
  await context.route("https://example.com/tms", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>Somewhere</title><h1>Somewhere</h1>" }));
});

test("shows the departure lounge and category controls", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /no plans/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /take me somewhere/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tiny games" })).toBeVisible();
});

test("opens the internal departure tab and reveals a destination", async ({ page, context }) => {
  await page.goto("/");
  const [popup] = await Promise.all([context.waitForEvent("page"), page.getByRole("button", { name: /take me somewhere/i }).click()]);
  await expect(popup.getByText("A Very Odd Portal")).toBeVisible({ timeout: 10_000 });
});
