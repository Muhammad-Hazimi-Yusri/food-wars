import { test, expect } from "@playwright/test";

test("home page loads with Noren header", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Food Wars.*食戟/ })).toBeVisible();
});