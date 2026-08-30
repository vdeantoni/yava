import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import {
  loadWithSegments,
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

    const download = await Promise.all([
      page.waitForEvent("download"),
      dialog.getByRole("button", { name: "Download" }).click(),
    ]).then(([d]) => d);
    const path = (await download.path())!;

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
});
