import { test, expect } from "@playwright/test";
import {
  PORTRAIT_FIXTURE,
  gotoVideoUrl,
  playerVideo,
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
  const video = (await playerVideo(page).boundingBox())!;
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

test("a short source sits centred above controls that meet the toolbar", async ({
  page,
  context,
}) => {
  await routeFixtureVideo(context);
  await gotoVideoUrl(page);
  await waitForEditor(page);

  const controls = (await page
    .getByRole("button", { name: "Skip to start" })
    .locator("../../..")
    .boundingBox())!;
  const toolbar = (await page
    .getByRole("button", { name: "Slice" })
    .locator("..")
    .boundingBox())!;
  expect(controls.y + controls.height).toBeCloseTo(toolbar.y, 0);

  // The sidebar sets the height, not the window: the timeline stays under it.
  const sidebar = (await page.locator("aside:visible").last().boundingBox())!;
  expect(toolbar.y).toBeCloseTo(sidebar.y + sidebar.height, 0);
  expect(toolbar.y).toBeLessThan(page.viewportSize()!.height - 200);

  const header = (await page.locator("header").boundingBox())!;
  const video = (await playerVideo(page).boundingBox())!;
  const room = { top: header.y + header.height, bottom: controls.y };
  expect(video.y + video.height / 2).toBeCloseTo(
    (room.top + room.bottom) / 2,
    0,
  );
});
