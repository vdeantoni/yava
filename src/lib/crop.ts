import { clamp } from "./utils";

/**
 * Crop rectangle geometry, in the player's displayed pixels.
 *
 * `vw`/`vh` record the size of the player the rectangle was drawn against, so
 * the numbers can be reproportioned when that box changes size and converted
 * against the source's intrinsic dimensions at export time.
 */
export type CropRectangle = {
  x: number;
  y: number;
  w: number;
  h: number;
  vw: number;
  vh: number;
};
export type Corner = "tl" | "tr" | "bl" | "br";

/** How near a corner a pointer counts as grabbing it. */
export const HANDLE_HIT_SIZE = 14;

/** Below this a drag has not yet drawn a rectangle worth keeping. */
const MIN_DRAWN_SIZE = 2;

export const EMPTY_CROP: CropRectangle = {
  x: 0,
  y: 0,
  w: 0,
  h: 0,
  vw: 0,
  vh: 0,
};

export function hasArea(rect: CropRectangle): boolean {
  return rect.w > 0 && rect.h > 0;
}

export function isInsideRect(
  px: number,
  py: number,
  rect: CropRectangle,
): boolean {
  return (
    hasArea(rect) &&
    px >= rect.x &&
    px <= rect.x + rect.w &&
    py >= rect.y &&
    py <= rect.y + rect.h
  );
}

/** Which corner handle the pointer is on, if any. */
export function cornerAt(
  px: number,
  py: number,
  rect: CropRectangle,
): Corner | null {
  if (!hasArea(rect)) return null;

  const { x, y, w, h } = rect;
  const near = (a: number, b: number) => Math.abs(a - b) <= HANDLE_HIT_SIZE;

  if (near(px, x) && near(py, y)) return "tl";
  if (near(px, x + w) && near(py, y)) return "tr";
  if (near(px, x) && near(py, y + h)) return "bl";
  if (near(px, x + w) && near(py, y + h)) return "br";

  return null;
}

/** Dragging a corner pivots around the opposite one. */
export function anchorForCorner(
  corner: Corner,
  rect: CropRectangle,
): { x: number; y: number } {
  const { x, y, w, h } = rect;
  const anchors: Record<Corner, { x: number; y: number }> = {
    tl: { x: x + w, y: y + h },
    tr: { x, y: y + h },
    bl: { x: x + w, y },
    br: { x, y },
  };
  return anchors[corner];
}

/** Where a moved rectangle lands, kept whole and inside the player. */
export function movedRect(
  rect: CropRectangle,
  px: number,
  py: number,
  grabOffset: { x: number; y: number },
  bounds: { width: number; height: number },
): CropRectangle {
  return {
    ...rect,
    x: clamp(px - grabOffset.x, bounds.width - rect.w),
    y: clamp(py - grabOffset.y, bounds.height - rect.h),
  };
}

/**
 * The rectangle between an anchor and the pointer, for both drawing a new one
 * and resizing an existing one. Null while it is still too small to mean
 * anything, which leaves the previous rectangle alone.
 */
export function drawnRect(
  rect: CropRectangle,
  anchor: { x: number; y: number },
  px: number,
  py: number,
): CropRectangle | null {
  const w = Math.abs(px - anchor.x);
  const h = Math.abs(py - anchor.y);
  if (w < MIN_DRAWN_SIZE || h < MIN_DRAWN_SIZE) return null;

  return {
    ...rect,
    x: Math.min(px, anchor.x),
    y: Math.min(py, anchor.y),
    w,
    h,
  };
}

/**
 * The rectangle in the source's intrinsic pixels. `vw`/`vh` of zero means the
 * rectangle was never measured against a player box, so the numbers are already
 * in source pixels and pass through.
 */
export function cropToSource(
  rect: CropRectangle,
  videoWidth: number,
  videoHeight: number,
): { x: number; y: number; w: number; h: number } {
  const sx = rect.vw ? videoWidth / rect.vw : 1;
  const sy = rect.vh ? videoHeight / rect.vh : 1;

  return { x: rect.x * sx, y: rect.y * sy, w: rect.w * sx, h: rect.h * sy };
}

/**
 * Reproportion a rectangle for a player that changed size. Returns null when
 * there is nothing to do, so callers do not write the same rectangle back.
 */
export function rescaledRect(
  rect: CropRectangle,
  width: number,
  height: number,
): CropRectangle | null {
  if (!hasArea(rect)) return null;
  if (rect.vw === width && rect.vh === height) return null;
  if (!rect.vw || !rect.vh || !width || !height) return null;

  const sx = width / rect.vw;
  const sy = height / rect.vh;

  return {
    x: rect.x * sx,
    y: rect.y * sy,
    w: rect.w * sx,
    h: rect.h * sy,
    vw: width,
    vh: height,
  };
}
