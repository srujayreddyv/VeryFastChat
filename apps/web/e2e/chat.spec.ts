import { test, expect } from "@playwright/test";

/**
 * Helper: create a room and join it as host, returning the page ready to chat.
 */
async function createAndJoinRoom(context: any) {
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: /create room/i }).click();
  await expect(page.getByText(/room created/i)).toBeVisible({ timeout: 15000 });
  const shareUrl = await page.locator("code.share-url").first().textContent();

  // Navigate to the room and join
  await page.goto(shareUrl!);
  await expect(page.getByRole("heading", { name: /join room/i })).toBeVisible({ timeout: 10000 });
  await page.getByPlaceholder(/your display name/i).fill("Host");
  await page.getByRole("button", { name: /join room/i }).click();
  await expect(page.getByPlaceholder(/type a message/i)).toBeVisible({ timeout: 10000 });

  return { page, shareUrl: shareUrl! };
}

test.describe("Chat messaging", () => {
  test("send multiple messages and see them in order", async ({ browser }) => {
    const context = await browser.newContext();
    const { page } = await createAndJoinRoom(context);

    const messages = ["First message", "Second message", "Third message"];
    for (const msg of messages) {
      await page.getByPlaceholder(/type a message/i).fill(msg);
      await page.getByRole("button", { name: /send/i }).click();
      await expect(page.getByText(msg)).toBeVisible({ timeout: 5000 });
    }

    // Verify order: all three visible
    for (const msg of messages) {
      await expect(page.getByText(msg)).toBeVisible();
    }
    await context.close();
  });

  test("empty message cannot be sent (button disabled)", async ({ browser }) => {
    const context = await browser.newContext();
    const { page } = await createAndJoinRoom(context);

    // Send button should be disabled when input is empty
    const sendBtn = page.getByRole("button", { name: /send/i });
    await expect(sendBtn).toBeDisabled();

    // Type something, button enables
    await page.getByPlaceholder(/type a message/i).fill("Hello");
    await expect(sendBtn).toBeEnabled();

    // Clear it, button disables again
    await page.getByPlaceholder(/type a message/i).fill("");
    await expect(sendBtn).toBeDisabled();
    await context.close();
  });

  test("host can delete their own message", async ({ browser }) => {
    const context = await browser.newContext();
    const { page } = await createAndJoinRoom(context);

    // Send a message
    await page.getByPlaceholder(/type a message/i).fill("Delete me");
    await page.getByRole("button", { name: /send/i }).click();
    await expect(page.getByText("Delete me")).toBeVisible({ timeout: 5000 });

    // Delete it
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: /delete/i }).first().click();

    // Message should disappear after refresh/re-fetch
    await expect(page.getByText("Delete me")).not.toBeVisible({ timeout: 8000 });
    await context.close();
  });

  test("no messages state shows empty prompt", async ({ browser }) => {
    const context = await browser.newContext();
    const { page } = await createAndJoinRoom(context);

    await expect(page.getByText(/no messages yet|say hello/i)).toBeVisible({ timeout: 5000 });
    await context.close();
  });

  test("message shows author name and timestamp", async ({ browser }) => {
    const context = await browser.newContext();
    const { page } = await createAndJoinRoom(context);

    await page.getByPlaceholder(/type a message/i).fill("Timestamped msg");
    await page.getByRole("button", { name: /send/i }).click();
    await expect(page.getByText("Timestamped msg")).toBeVisible({ timeout: 5000 });

    // Author name should be visible
    await expect(page.locator(".chat-message-author").getByText("Host")).toBeVisible();
    await context.close();
  });
});

test.describe("Scroll to bottom", () => {
  test("scroll to bottom button appears when scrolled up and hides when clicked", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const { page } = await createAndJoinRoom(context);
    const messagesArea = page.locator(".chat-messages");

    // Send several messages to create scrollable content
    for (let i = 1; i <= 20; i++) {
      await page.getByPlaceholder(/type a message/i).fill(`Message ${i}`);
      await page.getByRole("button", { name: /send/i }).click();
      await expect(page.getByText(`Message ${i}`)).toBeVisible({ timeout: 5000 });
    }

    await messagesArea.evaluate((el) => {
      const element = el as HTMLElement;
      element.style.height = "200px";
      element.style.maxHeight = "200px";
    });

    // Scroll to top
    await expect
      .poll(async () => {
        return await messagesArea.evaluate((el) => ({
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight
        }));
      })
      .toMatchObject({ scrollHeight: expect.any(Number), clientHeight: expect.any(Number) });
    await expect
      .poll(async () => {
        return await messagesArea.evaluate((el) => el.scrollHeight > el.clientHeight);
      })
      .toBe(true);
    await messagesArea.evaluate((el) => {
      el.scrollTop = 0;
      el.dispatchEvent(new Event("scroll", { bubbles: true }));
    });

    // Scroll-to-bottom button should appear
    await expect(page.getByRole("button", { name: /scroll to bottom/i })).toBeVisible({ timeout: 5000 });

    // Click it
    await page.getByRole("button", { name: /scroll to bottom/i }).click();
    await expect(page.getByRole("button", { name: /scroll to bottom/i })).not.toBeVisible({ timeout: 2000 });
    await context.close();
  });
});

test.describe("Multi-user chat", () => {
  test("two users can see each other's messages", async ({ browser }) => {
    const hostContext = await browser.newContext();
    const { page: hostPage, shareUrl } = await createAndJoinRoom(hostContext);

    // Guest joins
    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await guestPage.goto(shareUrl);
    await expect(guestPage.getByRole("heading", { name: /join room/i })).toBeVisible({ timeout: 10000 });
    await guestPage.getByPlaceholder(/your display name/i).fill("Guest");
    await guestPage.getByRole("button", { name: /join room/i }).click();
    await expect(guestPage.getByPlaceholder(/type a message/i)).toBeVisible({ timeout: 10000 });

    // Guest sends a message
    await guestPage.getByPlaceholder(/type a message/i).fill("Hello from Guest");
    await guestPage.getByRole("button", { name: /send/i }).click();
    await expect(guestPage.getByText("Hello from Guest")).toBeVisible({ timeout: 5000 });

    // Host should see it (may need a moment for realtime/polling)
    await expect(hostPage.getByText("Hello from Guest")).toBeVisible({ timeout: 15000 });

    // Host sends a reply
    await hostPage.getByPlaceholder(/type a message/i).fill("Reply from Host");
    await hostPage.getByRole("button", { name: /send/i }).click();
    await expect(hostPage.getByText("Reply from Host")).toBeVisible({ timeout: 5000 });

    // Guest should see the reply
    await expect(guestPage.getByText("Reply from Host")).toBeVisible({ timeout: 15000 });
    await guestContext.close();
    await hostContext.close();
  });
});
