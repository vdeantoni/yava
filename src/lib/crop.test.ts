import { describe, it, expect } from "vitest";
import {
  anchorForCorner,
  cornerAt,
  cropToSource,
  drawnRect,
  EMPTY_CROP,
  hasArea,
  HANDLE_HIT_SIZE,
  isInsideRect,
  movedRect,
  rescaledRect,
  type CropRectangle,
} from "./crop";

/** 100x50 rectangle at (20, 10), drawn against a 400x300 player. */
const rect: CropRectangle = { x: 20, y: 10, w: 100, h: 50, vw: 400, vh: 300 };
const bounds = { width: 400, height: 300 };

describe("hasArea", () => {
  it("needs both axes", () => {
    expect(hasArea(rect)).toBe(true);
    expect(hasArea({ ...rect, w: 0 })).toBe(false);
    expect(hasArea({ ...rect, h: 0 })).toBe(false);
    expect(hasArea(EMPTY_CROP)).toBe(false);
  });
});

describe("isInsideRect", () => {
  it("counts the edges as inside", () => {
    expect(isInsideRect(20, 10, rect)).toBe(true);
    expect(isInsideRect(120, 60, rect)).toBe(true);
  });

  it("rejects points outside", () => {
    expect(isInsideRect(19, 30, rect)).toBe(false);
    expect(isInsideRect(70, 61, rect)).toBe(false);
  });

  it("is never inside a rectangle with no area", () => {
    expect(isInsideRect(0, 0, EMPTY_CROP)).toBe(false);
  });
});

describe("cornerAt", () => {
  it("finds each corner", () => {
    expect(cornerAt(20, 10, rect)).toBe("tl");
    expect(cornerAt(120, 10, rect)).toBe("tr");
    expect(cornerAt(20, 60, rect)).toBe("bl");
    expect(cornerAt(120, 60, rect)).toBe("br");
  });

  it("allows a near miss up to the hit size", () => {
    expect(cornerAt(20 + HANDLE_HIT_SIZE, 10 + HANDLE_HIT_SIZE, rect)).toBe(
      "tl",
    );
    expect(
      cornerAt(20 + HANDLE_HIT_SIZE + 1, 10 + HANDLE_HIT_SIZE + 1, rect),
    ).toBe(null);
  });

  it("finds nothing in the middle, or without an area", () => {
    expect(cornerAt(70, 35, rect)).toBe(null);
    expect(cornerAt(0, 0, EMPTY_CROP)).toBe(null);
  });
});

describe("anchorForCorner", () => {
  it("returns the opposite corner", () => {
    expect(anchorForCorner("tl", rect)).toEqual({ x: 120, y: 60 });
    expect(anchorForCorner("br", rect)).toEqual({ x: 20, y: 10 });
    expect(anchorForCorner("tr", rect)).toEqual({ x: 20, y: 60 });
    expect(anchorForCorner("bl", rect)).toEqual({ x: 120, y: 10 });
  });
});

describe("movedRect", () => {
  const grab = { x: 10, y: 5 };

  it("moves by the pointer, less where it was grabbed", () => {
    expect(movedRect(rect, 60, 45, grab, bounds)).toMatchObject({
      x: 50,
      y: 40,
    });
  });

  it("keeps the size and the reference box", () => {
    const moved = movedRect(rect, 200, 200, grab, bounds);
    expect(moved.w).toBe(rect.w);
    expect(moved.h).toBe(rect.h);
    expect(moved.vw).toBe(rect.vw);
    expect(moved.vh).toBe(rect.vh);
  });

  it("stops at the top left", () => {
    expect(movedRect(rect, 0, 0, grab, bounds)).toMatchObject({ x: 0, y: 0 });
  });

  it("stops with the far edge at the boundary, not the near one", () => {
    // 400 - 100 wide, 300 - 50 tall.
    expect(movedRect(rect, 999, 999, grab, bounds)).toMatchObject({
      x: 300,
      y: 250,
    });
  });
});

describe("drawnRect", () => {
  const anchor = { x: 100, y: 100 };

  it("spans from the anchor to the pointer", () => {
    expect(drawnRect(rect, anchor, 180, 160)).toMatchObject({
      x: 100,
      y: 100,
      w: 80,
      h: 60,
    });
  });

  it("works when the pointer is above and left of the anchor", () => {
    expect(drawnRect(rect, anchor, 40, 30)).toMatchObject({
      x: 40,
      y: 30,
      w: 60,
      h: 70,
    });
  });

  it("keeps the reference box, since the player has not changed", () => {
    expect(drawnRect(rect, anchor, 180, 160)).toMatchObject({
      vw: 400,
      vh: 300,
    });
  });

  it("refuses a rectangle too small to mean anything", () => {
    expect(drawnRect(rect, anchor, 101, 160)).toBe(null);
    expect(drawnRect(rect, anchor, 180, 101)).toBe(null);
    expect(drawnRect(rect, anchor, 100, 100)).toBe(null);
  });
});

describe("cropToSource", () => {
  it("scales the rectangle from the player box to the source", () => {
    // The 400x300 player stands in for a 1600x1200 source: four times over.
    expect(cropToSource(rect, 1600, 1200)).toEqual({
      x: 80,
      y: 40,
      w: 400,
      h: 200,
    });
  });

  it("scales the axes independently, so a non-square SAR lands right", () => {
    expect(cropToSource(rect, 800, 300)).toEqual({
      x: 40,
      y: 10,
      w: 200,
      h: 50,
    });
  });

  it("passes the numbers through when there is no reference box", () => {
    // A rectangle typed in before the player has been measured is already in
    // source pixels, and dividing by zero would hand back Infinity.
    expect(cropToSource({ ...rect, vw: 0, vh: 0 }, 1600, 1200)).toEqual({
      x: 20,
      y: 10,
      w: 100,
      h: 50,
    });
  });
});

describe("rescaledRect", () => {
  it("scales every axis by how much the player changed", () => {
    // 400x300 to 200x150 is half in both directions.
    expect(rescaledRect(rect, 200, 150)).toEqual({
      x: 10,
      y: 5,
      w: 50,
      h: 25,
      vw: 200,
      vh: 150,
    });
  });

  it("scales the axes independently", () => {
    expect(rescaledRect(rect, 800, 300)).toMatchObject({
      x: 40,
      w: 200,
      y: 10,
      h: 50,
    });
  });

  it("does nothing when the player is the same size", () => {
    expect(rescaledRect(rect, 400, 300)).toBe(null);
  });

  it("does nothing without a rectangle to scale", () => {
    expect(rescaledRect(EMPTY_CROP, 200, 150)).toBe(null);
  });

  it("refuses to divide by a zero reference box", () => {
    // A rect typed into the panel before the player has been measured.
    expect(rescaledRect({ ...rect, vw: 0 }, 200, 150)).toBe(null);
    expect(rescaledRect(rect, 0, 0)).toBe(null);
  });
});
