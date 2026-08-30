import { test, expect, type Page } from "@playwright/test";
import {
  editStateFromHash,
  fadeInButton,
  loadWithSegments,
  movePlayhead,
  routeFixtureVideo,
  waitForEditor,
} from "./helpers";

/** How black the player's fade overlay currently is. */
function overlayOpacity(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector(".absolute.inset-0.bg-black");
    return el ? Number(getComputedStyle(el).opacity) : -1;
  });
}

/** The segment tuples in the hash, once the debounced write has landed. */
function pollSegments(page: Page) {
  return expect.poll(() => editStateFromHash(page)?.seg ?? null, {
    timeout: 5_000,
  });
}

test.describe("fades", () => {
  test.beforeEach(({ context }) => routeFixtureVideo(context));

  test("a fade rides along in the share link and survives a reload", async ({
    page,
  }) => {
    await loadWithSegments(page, [[0, 2]]);

    // Half way through a 2s clip, so the fade runs from 0 to about 1s.
    await movePlayhead(page, 0.5);
    await fadeInButton(page).click();

    await pollSegments(page).toHaveLength(1);
    const [segment] = editStateFromHash(page).seg;
    expect(segment).toHaveLength(4);
    expect(segment[2]).toBeGreaterThan(0.5);
    expect(segment[2]).toBeLessThan(1.5);
    // Fade out untouched, but it travels alongside the one that is set.
    expect(segment[3]).toBe(0);

    await page.reload();
    await waitForEditor(page);

    // The restored fade shows on the toggle, wherever the playhead sits.
    await movePlayhead(page, 0.25);
    await expect(fadeInButton(page)).toHaveAttribute("aria-pressed", "true");
  });

  test("the player darkens part way through a fade", async ({ page }) => {
    await loadWithSegments(page, [[0, 2]]);

    expect(await overlayOpacity(page)).toBe(0);

    await movePlayhead(page, 0.5);
    await fadeInButton(page).click();

    // A quarter of the way in is half way through the fade.
    await movePlayhead(page, 0.25);
    const halfway = await overlayOpacity(page);
    expect(halfway).toBeGreaterThan(0.3);
    expect(halfway).toBeLessThan(0.7);

    // Past the end of the fade the picture is clear again.
    await movePlayhead(page, 0.75);
    expect(await overlayOpacity(page)).toBe(0);
  });

  test("removing a fade brightens the picture where the playhead stands", async ({
    page,
  }) => {
    await loadWithSegments(page, [[0, 2]]);

    await movePlayhead(page, 0.5);
    await fadeInButton(page).click();

    // Park half way through the fade, where the overlay is visibly dark.
    await movePlayhead(page, 0.25);
    expect(await overlayOpacity(page)).toBeGreaterThan(0.3);

    // Nothing moves this time: the segment changes and the picture follows.
    await fadeInButton(page).click();
    expect(await overlayOpacity(page)).toBe(0);
  });
});
