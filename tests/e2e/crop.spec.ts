import { test, expect, type Page } from "@playwright/test";
import {
  drawCropRect,
  loadWithSegments,
  routeFixtureVideo,
  settledCanvasBox,
} from "./helpers";

test.beforeEach(({ context }) => routeFixtureVideo(context));

/** Count of non-transparent pixels the crop overlay has painted. */
function paintedPixels(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas")!;
    const data = canvas
      .getContext("2d")!
      .getImageData(0, 0, canvas.width, canvas.height).data;
    let painted = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) painted++;
    return painted;
  });
}

test.describe("crop overlay", () => {
  test("drawing a rectangle paints the overlay and sets the cursor", async ({
    page,
  }) => {
    await loadWithSegments(page, [[0, 2]]);

    const canvas = page.locator("canvas").first();
    await settledCanvasBox(page);
    expect(await paintedPixels(page)).toBe(0);

    const box = await drawCropRect(
      page,
      { x: 0.25, y: 0.25 },
      { x: 0.75, y: 0.75 },
    );

    expect(await paintedPixels(page)).toBeGreaterThan(0);

    // Cursor feedback proves the pointer coordinates land in canvas space:
    // inside the rectangle moves it, a corner resizes it.
    const cursorAt = async (x: number, y: number) => {
      await page.mouse.move(x, y);
      return canvas.evaluate((el) => el.style.cursor);
    };

    expect(await cursorAt(box.x + box.width / 2, box.y + box.height / 2)).toBe(
      "move",
    );
    expect(
      await cursorAt(box.x + box.width * 0.25, box.y + box.height * 0.25),
    ).toBe("nwse-resize");
    expect(await cursorAt(box.x + 2, box.y + 2)).toBe("crosshair");
  });
});
