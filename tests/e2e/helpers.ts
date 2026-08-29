import { expect, type BrowserContext, type Page } from "@playwright/test";
import { join } from "node:path";

/**
 * Deliberately unroutable host. Every request to it is fulfilled from the local
 * fixture by `routeFixtureVideo`, so these tests never touch the network. If the
 * route ever fails to register, the request fails loudly instead of silently
 * depending on a third party.
 */
export const VIDEO_URL = "https://videos.invalid/fixtures/tiny.mp4";

/**
 * 2s 160x120 h264 + aac, ~30KB. Regenerate with:
 *   ffmpeg -f lavfi -i testsrc=size=160x120:rate=15:duration=2 \
 *          -f lavfi -i sine=frequency=440:duration=2 \
 *          -c:v libx264 -pix_fmt yuv420p -preset ultrafast \
 *          -c:a aac -b:a 32k -shortest -movflags +faststart tests/fixtures/tiny.mp4
 */
export const FIXTURE = join(import.meta.dirname, "../fixtures/tiny.mp4");

/**
 * Serve the fixture for every request to VIDEO_URL. Routed on the context, not
 * the page, so tabs opened mid-test are covered too. contentType is stated
 * explicitly because the app gates on `blob.type.startsWith("video/")`.
 */
export function routeFixtureVideo(context: BrowserContext) {
  return context.route(VIDEO_URL, (route) =>
    route.fulfill({ contentType: "video/mp4", path: FIXTURE }),
  );
}

/** Wait for the editor to be ready ("Start Over" appears once a file is loaded). */
export async function waitForEditor(page: Page) {
  await expect(page.getByRole("button", { name: "Start Over" })).toBeVisible({
    timeout: 10_000,
  });
}

/** Poll the URL hash. The store subscription debounces writes by 500ms. */
export function pollHash(page: Page) {
  return expect.poll(() => new URL(page.url()).hash, { timeout: 5_000 });
}

/** Share hash for a set of segments, in the encoding `decodeEditState` expects. */
export function hashFor(seg: [number, number][]): string {
  return Buffer.from(JSON.stringify({ v: VIDEO_URL, seg }))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Open the editor on the fixture with `seg` restored from the hash. */
export async function loadWithSegments(page: Page, seg: [number, number][]) {
  await page.goto(`/#${hashFor(seg)}`);
  await waitForEditor(page);
}
