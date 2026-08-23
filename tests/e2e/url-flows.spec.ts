import { test, expect, type Page } from "@playwright/test";
import { join } from "node:path";

/**
 * Deliberately unroutable host. Every request to it is fulfilled from the local
 * fixture in beforeEach, so these tests never touch the network. If the route
 * ever fails to register, the request fails loudly instead of silently
 * depending on a third party.
 */
const VIDEO_URL = "https://videos.invalid/fixtures/tiny.mp4";

/**
 * 2s 160x120 h264 + aac, ~30KB. Regenerate with:
 *   ffmpeg -f lavfi -i testsrc=size=160x120:rate=15:duration=2 \
 *          -f lavfi -i sine=frequency=440:duration=2 \
 *          -c:v libx264 -pix_fmt yuv420p -preset ultrafast \
 *          -c:a aac -b:a 32k -shortest -movflags +faststart tests/fixtures/tiny.mp4
 */
const FIXTURE = join(import.meta.dirname, "../fixtures/tiny.mp4");

/** Wait for the editor to be ready (the "Start Over" button appears when a file is loaded). */
async function waitForEditor(page: Page) {
  await expect(page.getByRole("button", { name: "Start Over" })).toBeVisible({
    timeout: 10_000,
  });
}

/** Poll the URL hash. The store subscription debounces writes by 500ms. */
function pollHash(page: Page) {
  return expect.poll(() => new URL(page.url()).hash, { timeout: 5_000 });
}

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
  // Routed on the context, not the page, so tabs opened mid-test are covered too.
  test.beforeEach(async ({ context }) => {
    await context.route(VIDEO_URL, (route) =>
      // contentType is stated explicitly because the app gates on
      // blob.type.startsWith("video/").
      route.fulfill({ contentType: "video/mp4", path: FIXTURE }),
    );
  });

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
