import { test, expect, type Page } from "@playwright/test";
import { gotoVideoUrl, routeFixtureVideo } from "./helpers";

test.beforeEach(({ context }) => routeFixtureVideo(context));

/**
 * VideoPlayer builds its blob URL during render, so making that call throw
 * provokes a real render error from outside the app rather than needing a hook
 * inside it. Only video blobs are refused: react-media-recorder builds a blob
 * URL at import time, and breaking that one kills module evaluation before
 * React mounts, which no boundary can help with. The upload screen builds no
 * video blob URL, so recovery still works.
 */
async function breakRendering(page: Page) {
  await page.addInitScript(() => {
    const real = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (obj: Blob | MediaSource) => {
      if (obj instanceof Blob && obj.type.startsWith("video/")) {
        throw new Error("provoked render failure");
      }
      return real(obj);
    };
  });
}

test("a render error offers a way out instead of a blank page", async ({
  page,
}) => {
  await breakRendering(page);
  await gotoVideoUrl(page);

  await expect(page.getByText("Something went wrong")).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByRole("button", { name: "Start Over" })).toBeVisible();
});

test("starting over from the fallback returns to the upload screen", async ({
  page,
}) => {
  await breakRendering(page);
  await gotoVideoUrl(page);

  await page.getByRole("button", { name: "Start Over" }).click();

  await expect(page.getByText("Ready?")).toBeVisible();
  await expect(page.getByText("Something went wrong")).toHaveCount(0);
});
