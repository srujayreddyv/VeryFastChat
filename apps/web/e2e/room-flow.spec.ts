import { test, expect } from "@playwright/test";

test.describe("Room creation and sharing", () => {
  test("create room, copy link, open in new tab, join, send message", async ({ browser }) => {
    const context = await browser.newContext();
    const creatorPage = await context.newPage();
    await creatorPage.goto("/");
    await creatorPage.getByRole("button", { name: /create room/i }).click();
    await expect(creatorPage.getByText(/room created/i)).toBeVisible({ timeout: 15000 });
    const shareUrl = await creatorPage.locator("code.share-url").textContent();
    expect(shareUrl).toBeTruthy();

    const joinerPage = await context.newPage();
    await joinerPage.goto(shareUrl!);
    await expect(joinerPage.getByRole("heading", { name: /join room/i })).toBeVisible({ timeout: 10000 });
    await joinerPage.getByPlaceholder(/your display name/i).fill("Guest");
    await joinerPage.getByRole("button", { name: /join room/i }).click();
    await expect(joinerPage.getByPlaceholder(/type a message/i)).toBeVisible({ timeout: 10000 });

    await joinerPage.getByPlaceholder(/type a message/i).fill("Hello from E2E");
    await joinerPage.getByRole("button", { name: /send/i }).click();
    await expect(joinerPage.getByText("Hello from E2E")).toBeVisible({ timeout: 5000 });
    await context.close();
  });

  test("create room with custom name shows that name", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/");
    await page.getByPlaceholder(/room name/i).fill("My Custom Room");
    await page.getByRole("button", { name: /create room/i }).click();
    await expect(page.getByText(/room created/i)).toBeVisible({ timeout: 15000 });
    const shareUrl = await page.locator("code.share-url").textContent();
    expect(shareUrl).toBeTruthy();

    await page.goto(shareUrl!);
    await expect(page.getByText("My Custom Room")).toBeVisible({ timeout: 10000 });
    await context.close();
  });

  test("join room via slug input", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/");

    // Create a room first
    await page.getByRole("button", { name: /create room/i }).click();
    await expect(page.getByText(/room created/i)).toBeVisible({ timeout: 15000 });
    const shareUrl = await page.locator("code.share-url").textContent();
    expect(shareUrl).toBeTruthy();

    // Open a new page and join via the slug input
    const joinerPage = await context.newPage();
    await joinerPage.goto("/");
    await joinerPage.getByPlaceholder(/paste/i).or(joinerPage.getByPlaceholder(/room link/i)).fill(shareUrl!);
    await joinerPage.getByRole("button", { name: /^join$/i }).click();

    // Should navigate to the room page
    await expect(joinerPage.getByRole("heading", { name: /join room/i }).or(joinerPage.getByPlaceholder(/type a message/i))).toBeVisible({ timeout: 10000 });
    await context.close();
  });
});

test.describe("Host moderation", () => {
  test("host can lock then end room", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/");
    await page.getByRole("button", { name: /create room/i }).click();
    await expect(page.getByText(/room created/i)).toBeVisible({ timeout: 15000 });
    const shareUrl = await page.locator("code.share-url").first().textContent();
    expect(shareUrl).toBeTruthy();

    await page.goto(shareUrl!);
    await expect(page.getByRole("heading", { name: /join room/i })).toBeVisible({ timeout: 5000 });
    await page.getByPlaceholder(/your display name/i).fill("Host");
    await page.getByRole("button", { name: /join room/i }).click();
    await expect(page.getByPlaceholder(/type a message/i)).toBeVisible({ timeout: 10000 });

    // Lock
    await page.getByRole("button", { name: /lock room/i }).click();
    await expect(page.getByText("This room is locked. No new messages.")).toBeVisible({ timeout: 5000 });

    // End
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: /end room/i }).click();
    await expect(page.getByText("This room has ended.")).toBeVisible({ timeout: 8000 });
    await context.close();
  });

  test("host can lock then unlock room", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/");
    await page.getByRole("button", { name: /create room/i }).click();
    await expect(page.getByText(/room created/i)).toBeVisible({ timeout: 15000 });
    const shareUrl = await page.locator("code.share-url").first().textContent();
    expect(shareUrl).toBeTruthy();

    await page.goto(shareUrl!);
    await expect(page.getByRole("heading", { name: /join room/i })).toBeVisible({ timeout: 5000 });
    await page.getByPlaceholder(/your display name/i).fill("Host");
    await page.getByRole("button", { name: /join room/i }).click();
    await expect(page.getByPlaceholder(/type a message/i)).toBeVisible({ timeout: 10000 });

    // Lock
    await page.getByRole("button", { name: /lock room/i }).click();
    await expect(page.getByText("This room is locked. No new messages.")).toBeVisible({ timeout: 5000 });

    // Unlock
    await page.getByRole("button", { name: /unlock room/i }).click();
    // After unlock, the message input should be enabled again
    await expect(page.getByPlaceholder(/type a message/i)).toBeEnabled({ timeout: 5000 });
    await context.close();
  });
});
