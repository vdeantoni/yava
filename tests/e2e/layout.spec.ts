import { test, expect } from "@playwright/test";
import {
  PORTRAIT_FIXTURE,
  gotoVideoUrl,
  routeFixtureVideo,
  settledCanvasBox,
  trackLocator,
  waitForEditor,
} from "./helpers";

test.use({ viewport: { width: 1440, height: 900 } });

test("a portrait source leaves the timeline on screen", async ({
  page,
  context,
}) => {
  await routeFixtureVideo(context, PORTRAIT_FIXTURE);
  await gotoVideoUrl(page);
  await waitForEditor(page);

  // Both sides of the cap: reserve too little and the track falls off the
  // bottom, reserve too much and the picture is smaller than it has to be.
  const fold = page.viewportSize()!.height;
  const track = (await trackLocator(page).boundingBox())!;
  expect(track.y + track.height).toBeLessThanOrEqual(fold);
  expect(track.y + track.height).toBeGreaterThan(fold - 24);

  // Scaled down, not squashed.
  const video = (await page.locator("video").boundingBox())!;
  expect(video.width / video.height).toBeCloseTo(540 / 960, 2);
});

test("a source that already fits keeps its own size", async ({
  page,
  context,
}) => {
  await routeFixtureVideo(context);
  await gotoVideoUrl(page);
  await waitForEditor(page);

  expect(await settledCanvasBox(page)).toMatchObject({
    width: 160,
    height: 120,
  });
});
