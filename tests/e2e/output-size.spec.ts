import { test, expect, type Page } from "@playwright/test";
import {
  drawCropRect,
  loadWithSegments,
  routeFixtureVideo,
  visiblePanel,
} from "./helpers";

/** The Width and Height inputs of the export panel. */
function outputSize(page: Page) {
  const panel = visiblePanel(page, "Export");
  return {
    width: panel.getByLabel("Width", { exact: true }),
    height: panel.getByLabel("Height", { exact: true }),
  };
}

function drawCrop(page: Page, fraction: number) {
  return drawCropRect(page, { x: 0, y: 0 }, { x: fraction, y: fraction });
}

test.describe("output size", () => {
  test.beforeEach(({ context }) => routeFixtureVideo(context));

  test("defaults to the source size", async ({ page }) => {
    await loadWithSegments(page, [[0, 2]]);
    const size = outputSize(page);

    // The fixture is 160x120.
    await expect(size.width).toHaveValue("160");
    await expect(size.height).toHaveValue("120");
  });

  test("follows the crop rectangle while it is drawn", async ({ page }) => {
    await loadWithSegments(page, [[0, 2]]);
    const size = outputSize(page);
    await expect(size.width).toHaveValue("160");

    await drawCrop(page, 0.5);

    // Roughly half of each axis, and even, which the encoder requires.
    const width = Number(await size.width.inputValue());
    const height = Number(await size.height.inputValue());
    expect(width).toBeGreaterThan(50);
    expect(width).toBeLessThan(120);
    expect(height).toBeGreaterThan(30);
    expect(height).toBeLessThan(100);
    expect(width % 2).toBe(0);
    expect(height % 2).toBe(0);
  });

  test("a typed width survives a crop, and pins the aspect ratio", async ({
    page,
  }) => {
    await loadWithSegments(page, [[0, 2]]);
    const size = outputSize(page);

    await size.width.fill("80");
    // 160x120 is 4:3, so the height follows rather than staying at 120.
    await expect(size.height).toHaveValue("60");

    await drawCrop(page, 0.5);

    // The crop moved the aspect ratio, but the typed width holds.
    await expect(size.width).toHaveValue("80");
  });

  test("Reset returns both axes to automatic", async ({ page }) => {
    await loadWithSegments(page, [[0, 2]]);
    const size = outputSize(page);

    await size.width.fill("80");
    await expect(size.height).toHaveValue("60");

    await page
      .getByRole("button", { name: "Reset" })
      .filter({ visible: true })
      .last()
      .click();
    await expect(size.width).toHaveValue("160");
    await expect(size.height).toHaveValue("120");
  });
});
