import { test, expect } from "@playwright/test";

test.describe("Product CRUD", () => {
  test.beforeEach(async ({ page, context }) => {
    // Clear storage and enter guest mode
    await context.clearCookies();
    await context.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto("/");

    // Enter guest mode
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible({ timeout: 3000 });
    await modal.getByRole("button", { name: /Continue as Guest/i }).click();
    await expect(page.getByText("Guest Mode")).toBeVisible({ timeout: 10000 });
  });

  test("create a new product", async ({ page }) => {
    // Navigate to products page
    await page.goto("/master-data/products");
    await expect(page).toHaveURL(/\/master-data\/products/);

    // Click add button (link to /products/new)
    await page.locator('a[href="/products/new"]').first().click();
    await expect(page).toHaveURL(/\/products\/new/, { timeout: 10000 });

    // Fill name (on Basic tab, which is default)
    await page.getByLabel(/Name/i).fill("E2E Test Product");

    // Switch to Units tab
    await page.getByRole("tab", { name: /Units/i }).click();

    // Select stock quantity unit (required)
    await page.locator('button[role="combobox"]').first().click();
    await page.getByRole("option", { name: /Piece/i }).click();

    // Save and return
    await page.getByRole("button", { name: /Save & return/i }).click();

    // Verify back on list with new product
    await expect(page).toHaveURL(/\/master-data\/products/, { timeout: 10000 });
    await expect(page.getByText("E2E Test Product").first()).toBeVisible();
  });

  test("edit a product", async ({ page }) => {
    // Navigate to products page
    await page.goto("/master-data/products");

    // Find row with "Milk" and click edit link
    await page.locator('a[href*="/products/"][href$="/edit"]').first().click();

    // Wait for form
    await expect(page).toHaveURL(/\/products\/.*\/edit/, { timeout: 10000 });

    // Change name
    const nameInput = page.getByLabel(/Name/i);
    await nameInput.clear();
    await nameInput.fill("Milk Edited E2E");

    // Save
    await page.getByRole("button", { name: /Save & return/i }).click();

    // Verify change
    await expect(page).toHaveURL(/\/master-data\/products/, { timeout: 10000 });
    await expect(page.getByText("Milk Edited E2E").first()).toBeVisible();
  });

  test("delete a product", async ({ page }) => {
    const productName = `Delete Test ${Date.now()}`;

    // First create a product to delete
    await page.goto("/products/new");
    await page.getByLabel(/Name/i).fill(productName);
    await page.getByRole("tab", { name: /Units/i }).click();
    await page.locator('button[role="combobox"]').first().click();
    await page.getByRole("option", { name: /Piece/i }).click();
    await page.getByRole("button", { name: /Save & return/i }).click();
    await expect(page.getByText(productName).first()).toBeVisible();

    // Handle confirmation dialog
    page.on("dialog", (dialog) => dialog.accept());

    // Find row and click delete button
    const row = page.getByRole("row").filter({ hasText: productName }).first();
    await row.locator("button").last().click();

    // Wait and verify deleted
    await page.waitForTimeout(1000);
    await expect(page.getByText(productName)).toHaveCount(0, { timeout: 5000 });
  });
});