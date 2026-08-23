import { test, expect } from "@playwright/experimental-ct-react";
import VideoTimeline from "@/components/timeline/VideoTimeline";
import { withStore } from "../helpers";

// Segment highlights have z-10 + cursor-grab; the cursor handle has cursor-grab but no z-10
const segmentSelector = ".z-10.cursor-grab";

test("renders a segment highlight for a single segment", async ({ mount }) => {
  const component = await mount(<VideoTimeline />, withStore());

  await component.page().waitForTimeout(300);

  const highlights = component.locator(segmentSelector);
  await expect(highlights).toHaveCount(1);
});

test("renders multiple segment highlights for 2 segments", async ({
  mount,
}) => {
  const component = await mount(
    <VideoTimeline />,
    withStore({
      // Use pendingEditState so resetCursors creates multiple segments
      pendingEditState: {
        seg: [
          [0, 25],
          [35, 60],
        ],
      },
    }),
  );

  await component.page().waitForTimeout(300);

  const highlights = component.locator(segmentSelector);
  await expect(highlights).toHaveCount(2);
});

test("renders gap overlay between non-adjacent segments", async ({ mount }) => {
  const component = await mount(
    <VideoTimeline />,
    withStore({
      pendingEditState: {
        seg: [
          [0, 25],
          [35, 60],
        ],
      },
    }),
  );

  await component.page().waitForTimeout(300);

  // Gap overlay has bg-background/60 class
  const gaps = component.locator("[class*='bg-background']");
  await expect(gaps).toHaveCount(1);
});

test("shows resize handles when segment is hovered", async ({ mount }) => {
  const component = await mount(<VideoTimeline />, withStore());

  await component.page().waitForTimeout(300);

  // Before hover — no resize handles
  const handles = component.locator(".cursor-col-resize");
  await expect(handles).toHaveCount(0);

  // Hover over the segment highlight
  const highlight = component.locator(segmentSelector).first();
  await highlight.hover();

  // After hover — 2 resize handles (start + end)
  await expect(handles).toHaveCount(2);
});

test("shows delete action button when multiple segments and hovered", async ({
  mount,
}) => {
  const component = await mount(
    <VideoTimeline />,
    withStore({
      pendingEditState: {
        seg: [
          [0, 25],
          [35, 60],
        ],
      },
    }),
  );

  await component.page().waitForTimeout(300);

  // Hover over first segment to trigger actions
  const highlight = component.locator(segmentSelector).first();
  await highlight.hover();

  // Delete icon (Trash2) should be visible
  const deleteIcon = component.locator(".text-destructive");
  await expect(deleteIcon.first()).toBeVisible();
});
