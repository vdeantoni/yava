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
 * Same clip encoded as 10-bit H.264 (High 10) with BT.2020/HLG tags, the shape
 * an iPhone HDR source arrives in. Regenerate with:
 *   ffmpeg -f lavfi -i testsrc=size=160x120:rate=15:duration=2 \
 *          -f lavfi -i sine=frequency=440:duration=2 \
 *          -c:v libx264 -profile:v high10 -pix_fmt yuv420p10le -preset ultrafast \
 *          -color_primaries bt2020 -color_trc arib-std-b67 -colorspace bt2020nc \
 *          -c:a aac -b:a 32k -shortest -movflags +faststart tests/fixtures/ten-bit.mp4
 */
export const TEN_BIT_FIXTURE = join(
  import.meta.dirname,
  "../fixtures/ten-bit.mp4",
);

/**
 * HEVC, which plain Chromium builds cannot decode, so loading it is a reliable
 * "this browser has no decoder for that" case. Regenerate with:
 *   ffmpeg -f lavfi -i testsrc=size=160x120:rate=15:duration=2 \
 *          -c:v libx265 -preset ultrafast -pix_fmt yuv420p -tag:v hvc1 \
 *          -movflags +faststart tests/fixtures/hevc.mp4
 */
export const HEVC_FIXTURE = join(import.meta.dirname, "../fixtures/hevc.mp4");

/**
 * The same undecodable video track, but with an AAC track alongside it. The
 * audio is enough for Chromium to report metadata and readyState 4 and fire
 * loadeddata, so nothing raises an error and the editor opens on a video that
 * will never produce a frame. Regenerate with:
 *   ffmpeg -f lavfi -i testsrc=size=320x240:rate=15:duration=3 \
 *          -f lavfi -i sine=frequency=440:duration=3 \
 *          -c:v libx265 -preset ultrafast -pix_fmt yuv420p -tag:v hvc1 \
 *          -c:a aac -b:a 32k -shortest -movflags +faststart \
 *          tests/fixtures/hevc-audio.mp4
 */
export const HEVC_AUDIO_FIXTURE = join(
  import.meta.dirname,
  "../fixtures/hevc-audio.mp4",
);

/**
 * Serve a fixture for every request to VIDEO_URL. Routed on the context, not
 * the page, so tabs opened mid-test are covered too. contentType is stated
 * explicitly because the app gates on `blob.type.startsWith("video/")`.
 */
export function routeFixtureVideo(context: BrowserContext, path = FIXTURE) {
  return context.route(VIDEO_URL, (route) =>
    route.fulfill({ contentType: "video/mp4", path }),
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

/** Load the fixture through the explicit `?v=` video URL. */
export function gotoVideoUrl(page: Page) {
  return page.goto(`/?v=${encodeURIComponent(VIDEO_URL)}`);
}

/**
 * A panel scoped to whichever layout is on screen. Desktop and mobile both
 * mount every panel, and the accordion names each region after its trigger.
 */
export function visiblePanel(page: Page, name: string) {
  return page.getByRole("region", { name }).filter({ visible: true }).first();
}

/** The full-height grab target of the nth segment on the track. */
export function segmentHandle(page: Page, index: number) {
  return page.locator("div.h-16.cursor-grab").nth(index);
}

/**
 * Drag a crop rectangle across the player, from one corner to another, as
 * fractions of the canvas box. Returns the canvas box it measured.
 */
export async function drawCropRect(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const canvas = page.locator("canvas").first();
  // The canvas sizes itself from a debounced resize observer.
  await expect
    .poll(() => page.evaluate(() => document.querySelector("canvas")!.width))
    .toBeGreaterThan(0);

  const box = (await canvas.boundingBox())!;
  const at = (f: { x: number; y: number }) => ({
    x: box.x + box.width * f.x,
    y: box.y + box.height * f.y,
  });

  await page.mouse.move(at(from).x, at(from).y);
  await page.mouse.down();
  await page.mouse.move(at(to).x, at(to).y, { steps: 10 });
  await page.mouse.up();

  return box;
}
