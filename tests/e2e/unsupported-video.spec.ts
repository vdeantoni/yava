import { test, expect } from "@playwright/test";
import {
  HEVC_AUDIO_FIXTURE,
  HEVC_FIXTURE,
  gotoVideoUrl,
  routeFixtureVideo,
  waitForEditor,
} from "./helpers";

test("a video the browser cannot decode says so instead of going black", async ({
  page,
  context,
}) => {
  await routeFixtureVideo(context, HEVC_FIXTURE);
  await gotoVideoUrl(page);

  await expect(page.getByText("cannot decode this video")).toBeVisible({
    timeout: 10_000,
  });
  // The editor never opens, since metadata never arrived.
  await expect(page.getByRole("button", { name: "Export" })).toHaveCount(0);
});

test("a video that decodes no frames says so, even with no error raised", async ({
  page,
  context,
}) => {
  await routeFixtureVideo(context, HEVC_AUDIO_FIXTURE);
  await gotoVideoUrl(page);

  // This one gets far enough to open the editor: metadata, duration and
  // readyState 4 all arrive, and the element never raises an error.
  await waitForEditor(page);
  expect(
    await page.evaluate(() => {
      const video = document.querySelector("video")!;
      return { error: video.error, readyState: video.readyState };
    }),
  ).toEqual({ error: null, readyState: 4 });

  await expect(page.getByText("decoded no frames")).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText("Exporting still works")).toBeVisible();
});

test("a working video shows no warning at all", async ({ page, context }) => {
  await routeFixtureVideo(context);
  await gotoVideoUrl(page);
  await waitForEditor(page);

  // Outlast the frame check before concluding it stayed quiet.
  await page.waitForTimeout(3500);

  await expect(page.getByText("decoded no frames")).toHaveCount(0);
  await expect(page.getByText("cannot decode this video")).toHaveCount(0);
});
