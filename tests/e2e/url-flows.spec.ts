import { test, expect, type Page } from "@playwright/test";
import {
  pollHash,
  routeFixtureVideo,
  VIDEO_URL,
  waitForEditor,
} from "./helpers";

/** Load the fixture video via ?v= and wait for the editor and hash to settle. */
async function loadVideo(page: Page) {
  await page.goto(`/?v=${encodeURIComponent(VIDEO_URL)}`);
  await waitForEditor(page);
  await pollHash(page).toBeTruthy();
}

/** Load the video, toggle "Remove audio", and wait for the hash to change. */
async function loadVideoAndToggleAudio(page: Page): Promise<string> {
  await loadVideo(page);

  const hashBeforeEdit = new URL(page.url()).hash;

  const noAudioSwitch = page.locator("#no-audio").first();
  await noAudioSwitch.click();
  await expect(noAudioSwitch).toBeChecked();

  await pollHash(page).not.toBe(hashBeforeEdit);

  return page.url();
}

test.describe("URL flows", () => {
  test.beforeEach(({ context }) => routeFixtureVideo(context));

  test("?v= param loads a video from the network", async ({ page }) => {
    await loadVideo(page);

    // ?v= should have been consumed — URL should no longer contain it
    expect(page.url()).not.toContain("?v=");
  });

  test("hash URL round-trip survives reload", async ({ page }) => {
    await loadVideo(page);

    await page.reload();
    await waitForEditor(page);

    // Editor loaded again — video was restored from the hash URL
  });

  test("edit state persists through reload", async ({ page }) => {
    const urlBeforeReload = await loadVideoAndToggleAudio(page);

    await page.reload();
    await waitForEditor(page);

    // Wait for hash and verify it matches pre-reload value in one poll
    await pollHash(page).toBe(new URL(urlBeforeReload).hash);

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
