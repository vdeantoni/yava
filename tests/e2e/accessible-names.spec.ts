import { test, expect, type Page } from "@playwright/test";
import { loadWithSegments, routeFixtureVideo, segmentHandle } from "./helpers";

/**
 * Approximates the accessible name for the markup this app produces: the real
 * algorithm is much larger, but aria-label, aria-labelledby, an associated
 * label, title and text content cover every control here.
 */
async function unnamedControls(page: Page) {
  return page.evaluate(() => {
    const nameOf = (el: Element): string => {
      const aria = el.getAttribute("aria-label");
      if (aria?.trim()) return aria.trim();

      const by = el.getAttribute("aria-labelledby");
      if (by) {
        const text = by
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? "")
          .join(" ")
          .trim();
        if (text) return text;
      }

      const labels = (el as HTMLInputElement).labels;
      if (labels?.length) {
        return Array.from(labels)
          .map((l) => l.textContent ?? "")
          .join(" ")
          .trim();
      }

      return el.getAttribute("title")?.trim() || (el.textContent ?? "").trim();
    };

    const selector =
      'button, input, select, a, [role="slider"], [role="switch"], [role="combobox"]';
    return Array.from(document.querySelectorAll(selector))
      .filter((el) => !!(el as HTMLElement).offsetParent)
      .filter((el) => !nameOf(el))
      .map(
        (el) =>
          `${el.tagName.toLowerCase()}${
            el.getAttribute("role") ? `[role=${el.getAttribute("role")}]` : ""
          } class="${String(el.className).slice(0, 40)}"`,
      );
  });
}

test.describe("accessible names", () => {
  test.beforeEach(({ context }) => routeFixtureVideo(context));

  test("every control in the editor can be reached by name", async ({
    page,
  }) => {
    await loadWithSegments(page, [[0, 2]]);
    // Thumbnails and the resize observers settle after a beat.
    await page.waitForTimeout(1200);

    const unnamed = await unnamedControls(page);

    // The two Slider thumbs are the documented exception: Radix renders them
    // inside the primitive, and src/components/ui is CLI-managed output that
    // this project does not hand-edit, so no name can be passed to them.
    expect(unnamed.filter((c) => !c.includes("role=slider"))).toEqual([]);
    expect(unnamed).toHaveLength(2);
  });

  test("the player controls carry their own names", async ({ page }) => {
    await loadWithSegments(page, [[0, 2]]);

    // exact, because Playwright matches accessible names by substring and
    // "Slice at the playhead" contains "Play".
    for (const name of ["Play", "Skip to start", "Skip to end"]) {
      await expect(
        page.getByRole("button", { name, exact: true }),
      ).toBeVisible();
    }
    await expect(
      page.getByRole("button", { name: "Slice at the playhead" }),
    ).toBeVisible();
  });

  test("segment actions are buttons, not click-handling divs", async ({
    page,
  }) => {
    await loadWithSegments(page, [
      [0, 0.8],
      [0.8, 2],
    ]);

    // The actions appear while a segment is hovered.
    await segmentHandle(page, 0).hover();

    await expect(
      page.getByRole("button", { name: "Delete segment 1" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Join segment 1/ }),
    ).toBeVisible();
  });
});
