import { test, expect } from "@playwright/test";
import { gotoVideoUrl, routeFixtureVideo, waitForEditor } from "./helpers";

/**
 * The extractors reach a frame through `loadedmetadata`, a `play()` that only
 * one platform needs, and a seek. Nothing else here asserts that the chain ends
 * in pixels, so a rewiring of it fails silently as an empty timeline.
 */
test("the timeline fills with frames from the source", async ({
  page,
  context,
}) => {
  await routeFixtureVideo(context);
  await gotoVideoUrl(page);
  await waitForEditor(page);

  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const canvas = document.querySelector<HTMLCanvasElement>(
            "canvas[height='56']",
          );
          if (!canvas?.width) return 0;

          const { data } = canvas
            .getContext("2d")!
            .getImageData(0, 0, canvas.width, canvas.height);

          let painted = 0;
          for (let i = 3; i < data.length; i += 4) if (data[i] > 0) painted++;
          return painted;
        }),
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0);
});

test("the extractors leave nothing behind when the file does", async ({
  page,
  context,
}) => {
  await routeFixtureVideo(context);
  await gotoVideoUrl(page);
  await waitForEditor(page);

  await expect
    .poll(() => page.locator("video[data-thumbnail-extractor]").count())
    .toBeGreaterThan(0);

  await page.getByRole("button", { name: "Start Over" }).click();

  await expect(page.locator("video[data-thumbnail-extractor]")).toHaveCount(0);
});
