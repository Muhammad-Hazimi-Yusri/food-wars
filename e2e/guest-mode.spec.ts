import { test, expect } from "@playwright/test";

test.describe("Guest Mode Flow", () => {
  test.beforeEach(async ({ context }) => {
    // Clear all storage to simulate fresh visit
    await context.clearCookies();
    await context.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test("shows WelcomeModal on first visit", async ({ page }) => {
    await page.goto("/");

    // Wait for modal to appear (has 500ms delay)
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible({ timeout: 3000 });

    // Check modal content
    await expect(modal.getByText("いらっしゃいませ!")).toBeVisible();
    await expect(modal.getByText("Welcome to Food Wars")).toBeVisible();
    await expect(modal.getByRole("button", { name: /Sign in with Google/i })).toBeVisible();
    await expect(modal.getByRole("button", { name: /Continue as Guest/i })).toBeVisible();
  });

  test("clicking 'Continue as Guest' enters guest mode", async ({ page }) => {
    await page.goto("/");

    // Wait for modal and click guest button
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible({ timeout: 3000 });

    const guestButton = modal.getByRole("button", { name: /Continue as Guest/i });
    await guestButton.click();

    // Wait for reload and guest banner
    await expect(page.getByText("Guest Mode")).toBeVisible({ timeout: 10000 });
  });

  test("guest mode shows stock overview", async ({ page }) => {
    await page.goto("/");

    // Enter guest mode
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible({ timeout: 3000 });
    await modal.getByRole("button", { name: /Continue as Guest/i }).click();

    // Wait for guest mode
    await expect(page.getByText("Guest Mode")).toBeVisible({ timeout: 10000 });

    // Check for stock stats - use more specific selector
    // The stats show "X products" followed by bullet
    await expect(page.locator("text=/^\\d+ products?$/").first()).toBeVisible({ timeout: 5000 });
  });
});