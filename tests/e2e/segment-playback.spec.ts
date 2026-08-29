import { test, expect, type Page } from "@playwright/test";
import { loadWithSegments, routeFixtureVideo } from "./helpers";

/** Play from the start of the edit and resolve once playback settles. */
async function playToEnd(page: Page) {
  await page.evaluate(() => {
    const video = document.querySelector("video")!;
    video.currentTime = 0;
    return video.play();
  });

  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const video = document.querySelector("video")!;
          return { time: video.currentTime, paused: video.paused };
        }),
      { timeout: 10_000, message: "playback stalled" },
    )
    .toMatchObject({ paused: true });

  return page.evaluate(() => document.querySelector("video")!.currentTime);
}

test.describe("segment playback", () => {
  test.beforeEach(({ context }) => routeFixtureVideo(context));

  test("plays through a single cut", async ({ page }) => {
    await loadWithSegments(page, [
      [0, 0.7],
      [0.7, 2],
    ]);

    expect(await playToEnd(page)).toBeGreaterThan(1.9);
  });

  test("plays through two cuts", async ({ page }) => {
    await loadWithSegments(page, [
      [0, 0.7],
      [0.7, 1.4],
      [1.4, 2],
    ]);

    expect(await playToEnd(page)).toBeGreaterThan(1.9);
  });

  test("skips the gap left by a deleted segment", async ({ page }) => {
    await loadWithSegments(page, [
      [0, 0.6],
      [1.5, 2],
    ]);

    const samples = await page.evaluate(async () => {
      const video = document.querySelector("video")!;
      video.currentTime = 0;
      const started = performance.now();
      await video.play();
      const times: number[] = [];
      while (!video.paused && performance.now() - started < 10_000) {
        times.push(video.currentTime);
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      return times;
    });

    expect(samples.at(-1)).toBeGreaterThan(1.9);
    // The jump is driven by timeupdate, so playback overshoots 0.6 a little.
    // It must never get deep into the gap.
    expect(samples.filter((t) => t > 1 && t < 1.45)).toEqual([]);
  });
});
