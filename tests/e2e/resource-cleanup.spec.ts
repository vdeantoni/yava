import { test, expect } from "@playwright/test";
import { gotoVideoUrl, routeFixtureVideo, waitForEditor } from "./helpers";

/**
 * A blob URL keeps its Blob alive on its own, so one left behind holds the
 * whole file for the life of the document. Nothing on screen shows that, which
 * is why it went unnoticed: fetching a revoked URL is the only cheap proof.
 */
test("Start Over lets go of the file", async ({ page, context }) => {
  await routeFixtureVideo(context);
  await gotoVideoUrl(page);
  await waitForEditor(page);

  const url = await page.evaluate(
    () => document.querySelector("video")!.getAttribute("src")!,
  );
  expect(url).toMatch(/^blob:/);

  const reachable = (u: string) =>
    page.evaluate(
      (target) =>
        fetch(target)
          .then(() => true)
          .catch(() => false),
      u,
    );

  expect(await reachable(url)).toBe(true);

  await page.getByRole("button", { name: "Start Over" }).click();
  await page.getByRole("button", { name: "Browse Files" }).waitFor();

  expect(await reachable(url)).toBe(false);
});
