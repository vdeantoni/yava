import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import {
  fadeInButton,
  loadWithSegments,
  movePlayhead,
  routeFixtureVideo,
  TEN_BIT_FIXTURE,
} from "./helpers";

/** Click the export trigger and wait for the dialog to appear. */
async function openExportDialog(page: Page) {
  // The panel's accordion header is also a button named "Export", and both the
  // desktop and mobile layouts render a trigger, of which one is visible.
  await page
    .locator('button[aria-haspopup="dialog"]')
    .filter({ hasText: /^Export$/ })
    .filter({ visible: true })
    .first()
    .click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  return dialog;
}

/** Open the export dialog and wait for the run to finish either way. */
async function exportAndWait(page: Page) {
  const dialog = await openExportDialog(page);

  await expect(dialog.getByRole("heading").first()).toHaveText(
    /Export Complete|Export Failed/,
    { timeout: 220_000 },
  );

  return dialog;
}

/** Duration of the produced file, read off the dialog's preview player. */
async function previewDuration(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document.querySelector<HTMLVideoElement>('[role="dialog"] video')
              ?.readyState ?? 0,
        ),
      { timeout: 10_000, message: "the preview never loaded metadata" },
    )
    .toBeGreaterThan(0);

  return page.evaluate(
    () =>
      document.querySelector<HTMLVideoElement>('[role="dialog"] video')!
        .duration,
  );
}

/** Download what the dialog produced and hand back the local path. */
async function saveExport(page: Page) {
  const download = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download" }).click(),
  ]).then(([d]) => d);

  return (await download.path())!;
}

/** Decode from `at` seconds to stdout, however `args` asks for it. */
function decodeAt(path: string, at: number, args: string[]): Buffer {
  return execFileSync(
    "ffmpeg",
    ["-v", "error", "-ss", String(at), "-i", path, ...args, "-"],
    { maxBuffer: 64 * 1024 * 1024 },
  );
}

/** Brightest luma in the frame at `at` seconds, 0 to 255. */
function brightestLuma(path: string, at: number): number {
  const frame = decodeAt(path, at, [
    "-frames:v",
    "1",
    "-f",
    "rawvideo",
    "-pix_fmt",
    "gray",
  ]);

  let brightest = 0;
  for (const luma of frame) if (luma > brightest) brightest = luma;
  return brightest;
}

/** Loudest sample in the 100ms of audio starting at `at`, 0 to 32767. */
function peakAmplitude(path: string, at: number): number {
  const pcm = decodeAt(path, at, [
    "-t",
    "0.1",
    "-vn",
    "-f",
    "s16le",
    "-ac",
    "1",
    "-ar",
    "8000",
  ]);

  let peak = 0;
  for (let i = 0; i + 1 < pcm.length; i += 2) {
    peak = Math.max(peak, Math.abs(pcm.readInt16LE(i)));
  }
  return peak;
}

test.beforeEach(({ context }) => routeFixtureVideo(context));

test.describe("export dialog", () => {
  test("pauses the player when it opens", async ({ page, context }) => {
    // The dialog starts a run as soon as it opens. Nothing here needs the real
    // encoder, so the fetch is aborted and the run fails immediately.
    await context.route("https://unpkg.com/**", (route) => route.abort());
    await loadWithSegments(page, [[0, 2]]);

    const paused = () =>
      page.evaluate(() => document.querySelector("video")!.paused);

    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(paused).toBe(false);
    // The clip is 2s, and reaching its end would pause the player on its own.
    await page.evaluate(
      () => (document.querySelector("video")!.playbackRate = 0.25),
    );

    await openExportDialog(page);

    await expect.poll(paused).toBe(true);
  });
});

test.describe("export failures", () => {
  test("says so when the encoder cannot be fetched", async ({
    page,
    context,
  }) => {
    await context.route("https://unpkg.com/**", (route) => route.abort());
    await loadWithSegments(page, [[0, 2]]);

    const dialog = await exportAndWait(page);

    await expect(dialog.getByRole("heading").first()).toHaveText(
      "Export Failed",
    );
    await expect(
      dialog.getByText("Could not load the video encoder", { exact: false }),
    ).toBeVisible();
    // No half-finished result offered, and the run is over, so the footer
    // says Close rather than Cancel.
    await expect(dialog.getByRole("button", { name: "Download" })).toBeHidden();
    await expect(dialog.getByRole("button", { name: "Cancel" })).toHaveCount(0);
  });
});

/**
 * The real FFmpeg pipeline, end to end. Off by default: it pulls the ~32MB WASM
 * core from unpkg, and the rest of the e2e suite is deliberately hermetic.
 * Run with YAVA_E2E_FFMPEG=1.
 */
test.describe("export", () => {
  test.skip(
    !process.env.YAVA_E2E_FFMPEG,
    "set YAVA_E2E_FFMPEG=1 to run the real FFmpeg export",
  );

  test("exports a single trimmed segment", async ({ page }) => {
    test.setTimeout(240_000);
    await loadWithSegments(page, [[0.5, 1.5]]);

    const dialog = await exportAndWait(page);

    await expect(dialog.getByRole("heading").first()).toHaveText(
      "Export Complete",
    );
    await expect(
      dialog.getByRole("button", { name: "Download" }),
    ).toBeVisible();
    expect(await previewDuration(page)).toBeGreaterThan(0.8);
  });

  test("concatenates three segments into one file", async ({ page }) => {
    test.setTimeout(240_000);
    await loadWithSegments(page, [
      [0, 0.6],
      [0.7, 1.2],
      [1.4, 2],
    ]);

    const dialog = await exportAndWait(page);

    await expect(dialog.getByRole("heading").first()).toHaveText(
      "Export Complete",
    );
    // 1.7s of kept content, so the gaps were dropped rather than encoded.
    const duration = await previewDuration(page);
    expect(duration).toBeGreaterThan(1.4);
    expect(duration).toBeLessThan(2);
  });

  test("downgrades a 10-bit source to 8-bit, which browsers can decode", async ({
    page,
    context,
  }) => {
    test.setTimeout(240_000);
    // Overrides the tiny.mp4 route registered above.
    await routeFixtureVideo(context, TEN_BIT_FIXTURE);
    await loadWithSegments(page, [[0, 2]]);

    const dialog = await exportAndWait(page);
    await expect(dialog.getByRole("heading").first()).toHaveText(
      "Export Complete",
    );

    const path = await saveExport(page);

    const probed = execFileSync("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=profile,pix_fmt",
      "-of",
      "csv=p=0",
      path,
    ])
      .toString()
      .trim();

    expect(probed).toContain("yuv420p");
    expect(probed).not.toContain("10");
  });

  test("bakes a fade to black into the exported frames", async ({ page }) => {
    test.setTimeout(240_000);
    await loadWithSegments(page, [[0, 2]]);

    // Fade the first half of the clip up from black.
    await movePlayhead(page, 0.5);
    await fadeInButton(page).click();

    const dialog = await exportAndWait(page);
    await expect(dialog.getByRole("heading").first()).toHaveText(
      "Export Complete",
    );

    const path = await saveExport(page);

    // The source is a test pattern with white in it, so the first frame being
    // dark can only be the fade. Past the fade it is back to full brightness.
    expect(brightestLuma(path, 0)).toBeLessThan(40);
    expect(brightestLuma(path, 1.5)).toBeGreaterThan(150);

    // The sine tone fades with the picture rather than opening at full volume.
    expect(peakAmplitude(path, 0)).toBeLessThan(peakAmplitude(path, 1.5) / 4);
  });
});
