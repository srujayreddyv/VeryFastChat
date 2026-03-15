import { test, expect } from "@playwright/test";

test.describe("VeryFastChat smoke", () => {
  test("home page shows create and join", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /veryfastchat/i })).toBeVisible();
    await expect(page.getByPlaceholder(/paste/i).or(page.getByPlaceholder(/room link/i))).toBeVisible();
    await expect(page.getByRole("button", { name: /join/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /create room/i })).toBeVisible();
  });

  test("home page has room name and image URL inputs", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByPlaceholder(/room name/i)).toBeVisible();
    await expect(page.getByPlaceholder(/room image url/i)).toBeVisible();
  });

  test("sidebar has Home, Create room, Join a room", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /home/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /create room/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /join a room/i })).toBeVisible();
  });

  test("sidebar shows empty rooms state", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/rooms you join will appear here/i)).toBeVisible();
  });

  test("theme button opens dropdown", async ({ page }) => {
    await page.goto("/");
    const themeBtn = page.getByRole("button", { name: /theme/i });
    await themeBtn.click();
    await expect(page.getByRole("menuitem", { name: /light/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /dark/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /system/i })).toBeVisible();
  });

  test("theme switch to Dark updates UI", async ({ page }) => {
    await page.goto("/");
    const themeBtn = page.getByRole("button", { name: /theme/i });
    await themeBtn.click();
    await page.getByRole("menuitem", { name: /dark/i }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("theme switch to Light updates UI", async ({ page }) => {
    await page.goto("/");
    const themeBtn = page.getByRole("button", { name: /theme/i });
    await themeBtn.click();
    await page.getByRole("menuitem", { name: /light/i }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });

  test("invalid room slug shows room not found or join form", async ({ page }) => {
    await page.goto("/r/nonexistent-room-slug-12345");
    await page.waitForLoadState("networkidle");
    const error = page.getByText(/room not found|join room|could not load|network error/i);
    await expect(error).toBeVisible({ timeout: 10000 });
  });

  test("room error state shows Try again button", async ({ page }) => {
    await page.goto("/r/nonexistent-room-slug-12345");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: /try again/i })).toBeVisible({ timeout: 10000 });
  });

  test("sign in and sign up buttons visible for anonymous users", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /sign up/i })).toBeVisible();
  });

  test("join with empty slug shows validation error", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /^join$/i }).click();
    await expect(page.getByText(/enter a room link or slug/i)).toBeVisible();
  });

  test("404 page shows for unknown routes", async ({ page }) => {
    await page.goto("/this-page-does-not-exist");
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible({ timeout: 10000 });
  });
});
