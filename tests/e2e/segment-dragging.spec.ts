import { test, expect, type Page } from "@playwright/test";
import {
  loadWithSegments,
  movePlayhead,
  routeFixtureVideo,
  segmentHandle,
  visiblePanel,
} from "./helpers";

/** Start and End of the selected segment, from the visible trim panel. */
function segmentBounds(page: Page) {
  const panel = visiblePanel(page, "Trim");
  return {
    start: panel.getByLabel("Start", { exact: true }),
    end: panel.getByLabel("End", { exact: true }),
  };
}

test.describe("segment dragging", () => {
  test.beforeEach(({ context }) => routeFixtureVideo(context));

  test("dragging a segment stops it against its neighbour", async ({
    page,
  }) => {
    // A 0.6s segment with room to move right until 1.2s.
    await loadWithSegments(page, [
      [0, 0.6],
      [1.2, 2],
    ]);

    const first = segmentHandle(page, 0);
    await first.hover();

    const bounds = segmentBounds(page);
    await expect(bounds.start).toHaveValue("00:00:000");
    await expect(bounds.end).toHaveValue("00:00:600");

    // Drag it far further right than it can go.
    const box = (await first.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 600, box.y + box.height / 2, {
      steps: 10,
    });
    await page.mouse.up();

    // Moving the pointer over the second segment selects it, so the panel is
    // showing that one by now: point at the dragged segment again to read it.
    await segmentHandle(page, 0).hover();

    // Length preserved, far edge parked on the neighbour rather than through it.
    await expect(bounds.end).toHaveValue("00:01:200");
    await expect(bounds.start).toHaveValue("00:00:600");
  });

  test("dragging a segment's edge resizes only that edge", async ({ page }) => {
    await loadWithSegments(page, [
      [0, 0.6],
      [1.2, 2],
    ]);

    const first = segmentHandle(page, 0);
    await first.hover();
    const bounds = segmentBounds(page);
    await expect(bounds.end).toHaveValue("00:00:600");

    // The end handle sits on the segment's right edge.
    const box = (await first.boundingBox())!;
    await page.mouse.move(box.x + box.width, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width + 60, box.y + box.height / 2, {
      steps: 8,
    });
    await page.mouse.up();

    await expect(bounds.start).toHaveValue("00:00:000");
    expect(
      Number((await bounds.end.inputValue()).split(":").pop()),
    ).toBeGreaterThan(600);
  });

  test("dragging the playhead moves it and stops at the end of the edit", async ({
    page,
  }) => {
    await loadWithSegments(page, [[0, 2]]);

    // Also scrolls the track into view, so the raw pointer moves below land.
    await movePlayhead(page, 0.25);
    const playheadTime = () =>
      page.evaluate(() => document.querySelector("video")!.currentTime);
    expect(await playheadTime()).toBeCloseTo(0.5, 1);

    const box = (await page
      .locator("div.relative.h-16")
      .first()
      .boundingBox())!;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.25, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.75, y, { steps: 10 });
    await page.mouse.up();

    expect(await playheadTime()).toBeCloseTo(1.5, 1);

    // Past the last segment's end the drag stops following rather than running
    // off the clip.
    await page.mouse.move(box.x + box.width * 0.75, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width + 200, y, { steps: 10 });
    await page.mouse.up();

    expect(await playheadTime()).toBeCloseTo(2, 1);
  });
});
