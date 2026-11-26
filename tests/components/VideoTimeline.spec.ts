import { test, expect } from "@playwright/test";
import type { Default } from "@/components/timeline/VideoTimeline.story.tsx";

const TIMELINE = "components/timeline/VideoTimeline/Default";

// Segment highlights have z-10 + cursor-grab; the cursor handle has cursor-grab but no z-10
const segmentSelector = ".z-10.cursor-grab";

test("renders a segment highlight for a single segment", async ({ mount }) => {
  const component = await mount(TIMELINE);

  await component.page().waitForTimeout(300);

  const highlights = component.locator(segmentSelector);
  await expect(highlights).toHaveCount(1);
});

test("renders multiple segment highlights for 2 segments", async ({
  mount,
}) => {
  const component = await mount<typeof Default>(TIMELINE, {
    // resetCursors builds the segments from this, as it does for a share link.
    pendingEditState: {
      seg: [
        [0, 25],
        [35, 60],
      ],
    },
  });

  await component.page().waitForTimeout(300);

  const highlights = component.locator(segmentSelector);
  await expect(highlights).toHaveCount(2);
});

test("renders gap overlay between non-adjacent segments", async ({ mount }) => {
  const component = await mount<typeof Default>(TIMELINE, {
    pendingEditState: {
      seg: [
        [0, 25],
        [35, 60],
      ],
    },
  });

  await component.page().waitForTimeout(300);

  // Gap overlay has bg-background/60 class
  const gaps = component.locator("[class*='bg-background']");
  await expect(gaps).toHaveCount(1);
});

test("shows resize handles when segment is hovered", async ({ mount }) => {
  const component = await mount(TIMELINE);

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
  const component = await mount<typeof Default>(TIMELINE, {
    pendingEditState: {
      seg: [
        [0, 25],
        [35, 60],
      ],
    },
  });

  await component.page().waitForTimeout(300);

  // Hover over first segment to trigger actions
  const highlight = component.locator(segmentSelector).first();
  await highlight.hover();

  // Delete icon (Trash2) should be visible
  const deleteIcon = component.locator(".text-destructive");
  await expect(deleteIcon.first()).toBeVisible();
});
