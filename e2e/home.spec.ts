import { test, expect } from "@playwright/test";

test("home page loads with Noren header", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Food Wars.*食戟/ })).toBeVisible();
});