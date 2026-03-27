import { test, expect, type Page } from "@playwright/test";

const VIDEO_URL =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";

/** Wait for the editor to be ready (the "Start Over" button appears when a file is loaded). */
async function waitForEditor(page: Page) {
  await expect(page.getByRole("button", { name: "Start Over" })).toBeVisible({
    timeout: 30_000,
  });
}

/** Wait for the URL hash to be set (store subscription has a 500ms debounce). */
async function waitForHash(page: Page) {
  await expect
    .poll(() => new URL(page.url()).hash, { timeout: 5_000 })
    .toBeTruthy();
}

/** Load video via ?v=, wait for editor + hash, toggle "Remove audio", wait for hash to change. */
async function loadVideoAndToggleAudio(page: Page): Promise<string> {
  await page.goto(`/?v=${encodeURIComponent(VIDEO_URL)}`);
  await waitForEditor(page);
  await waitForHash(page);

  const hashBeforeEdit = new URL(page.url()).hash;

  const noAudioSwitch = page.locator("#no-audio").first();
  await noAudioSwitch.click();
  await expect(noAudioSwitch).toBeChecked();

  await expect
    .poll(() => new URL(page.url()).hash, { timeout: 5_000 })
    .not.toBe(hashBeforeEdit);

  return page.url();
}

test.describe("URL flows", () => {
  test("?v= param loads a video from the network", async ({ page }) => {
    await page.goto(`/?v=${encodeURIComponent(VIDEO_URL)}`);
    await waitForEditor(page);
    await waitForHash(page);

    // ?v= should have been consumed — URL should no longer contain it
    expect(page.url()).not.toContain("?v=");
  });

  test("hash URL round-trip survives reload", async ({ page }) => {
    await page.goto(`/?v=${encodeURIComponent(VIDEO_URL)}`);
    await waitForEditor(page);
    await waitForHash(page);

    await page.reload();
    await waitForEditor(page);

    // Editor loaded again — video was restored from the hash URL
  });

  test("edit state persists through reload", async ({ page }) => {
    const urlBeforeReload = await loadVideoAndToggleAudio(page);

    await page.reload();
    await waitForEditor(page);

    // Wait for hash and verify it matches pre-reload value in one poll
    await expect
      .poll(() => new URL(page.url()).hash, { timeout: 5_000 })
      .toBe(new URL(urlBeforeReload).hash);

    // "Remove audio" should still be on
    await expect(page.locator("#no-audio").first()).toBeChecked();
  });

  test("share URL opens with same state in a new tab", async ({
    page,
    context,
  }) => {
    const shareUrl = await loadVideoAndToggleAudio(page);

    // Open in a new tab
    const page2 = await context.newPage();
    try {
      await page2.goto(shareUrl);
      await waitForEditor(page2);

      // "Remove audio" should be on in the new tab
      await expect(page2.locator("#no-audio").first()).toBeChecked();
    } finally {
      await page2.close();
    }
  });
});
