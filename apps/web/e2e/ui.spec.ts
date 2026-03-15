import { test, expect } from "@playwright/test";

test.describe("Sidebar", () => {
  test("sidebar toggle hides and shows sidebar", async ({ page }) => {
    await page.goto("/");
    // Sidebar should be visible by default
    const sidebar = page.locator("aside[aria-label='Navigation']");
    await expect(sidebar).toBeVisible();

    // Click toggle to hide
    await page.getByRole("button", { name: /hide sidebar/i }).click();
    await expect(sidebar).toHaveAttribute("aria-hidden", "true");

    // Click toggle to show
    await page.getByRole("button", { name: /show sidebar/i }).click();
    await expect(sidebar).not.toHaveAttribute("aria-hidden", "true");
  });

  test("sidebar toggle via keyboard shortcut Ctrl+B", async ({ page }) => {
    await page.goto("/");
    const sidebar = page.locator("aside[aria-label='Navigation']");
    await expect(sidebar).toBeVisible();

    // Press Ctrl+B to hide
    await page.keyboard.press("Control+b");
    await expect(sidebar).toHaveAttribute("aria-hidden", "true");

    // Press Ctrl+B to show
    await page.keyboard.press("Control+b");
    await expect(sidebar).not.toHaveAttribute("aria-hidden", "true");
  });

  test("room appears in sidebar after creation", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/");

    // Initially no rooms
    await expect(page.getByText(/rooms you join will appear here/i)).toBeVisible();

    // Create a room
    await page.getByRole("button", { name: /create room/i }).click();
    await expect(page.getByText(/room created/i)).toBeVisible({ timeout: 15000 });

    // Enter the room to trigger addJoinedRoom
    await page.getByRole("button", { name: /enter room/i }).click();
    await expect(page.getByRole("heading", { name: /join room/i }).or(page.getByPlaceholder(/type a message/i))).toBeVisible({ timeout: 10000 });

    // Go back home — sidebar should now show the room
    await page.goto("/");
    // The sidebar rooms list should no longer show the empty state
    await expect(page.getByText(/rooms you join will appear here/i)).not.toBeVisible({ timeout: 5000 });
    await context.close();
  });
});

test.describe("Sign In Modal", () => {
  test("sign in modal opens and closes", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Modal should be visible
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();

    // Close it
    await page.getByRole("button", { name: /close/i }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("sign up modal opens from sign up button", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /sign up/i }).click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: /create account/i })).toBeVisible();

    // Should have display name field
    await expect(page.getByLabel(/display name/i)).toBeVisible();
  });

  test("switch between sign in and sign up modes", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();

    // Switch to sign up
    await page.getByRole("button", { name: /need an account/i }).click();
    await expect(page.getByRole("heading", { name: /create account/i })).toBeVisible();

    // Switch back to sign in
    await page.getByRole("button", { name: /already have an account/i }).click();
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  });

  test("forgot password link switches to reset mode", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();

    await page.getByRole("button", { name: /forgot password/i }).click();
    await expect(page.getByRole("heading", { name: /reset password/i })).toBeVisible();

    // Back to sign in
    await page.getByRole("button", { name: /back to sign in/i }).click();
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  });

  test("modal closes when clicking overlay", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Click the overlay (outside the modal content)
    await page.locator(".modal-overlay").click({ position: { x: 10, y: 10 } });
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("sign in form has email and password fields", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /sign in/i }).click();
    const dialog = page.getByRole("dialog");

    await expect(dialog.getByLabel(/email/i)).toBeVisible();
    await expect(dialog.getByLabel(/password/i)).toBeVisible();
    await expect(dialog.getByRole("button", { name: /^sign in$/i })).toBeVisible();
  });
});

test.describe("Theme persistence", () => {
  test("theme choice persists across page loads", async ({ page }) => {
    await page.goto("/");

    // Switch to dark
    await page.getByRole("button", { name: /theme/i }).click();
    await page.getByRole("menuitem", { name: /dark/i }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    // Reload
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    // Switch to light
    await page.getByRole("button", { name: /theme/i }).click();
    await page.getByRole("menuitem", { name: /light/i }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    // Reload again
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });
});

test.describe("Accessibility basics", () => {
  test("main content area has proper landmark", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main#main-content")).toBeVisible();
  });

  test("sidebar has navigation landmark", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("aside[aria-label='Navigation']")).toBeVisible();
  });

  test("theme dropdown has proper ARIA attributes", async ({ page }) => {
    await page.goto("/");
    const themeBtn = page.getByRole("button", { name: /theme/i });
    await expect(themeBtn).toHaveAttribute("aria-haspopup", "true");
    await expect(themeBtn).toHaveAttribute("aria-expanded", "false");

    await themeBtn.click();
    await expect(themeBtn).toHaveAttribute("aria-expanded", "true");
  });
});
