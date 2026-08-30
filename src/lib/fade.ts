import {
  clamp,
  findSegmentAt,
  MIN_FADE_DURATION,
  type SegmentLike,
} from "./utils";

/**
 * Fades to and from black, held on the segment they belong to.
 *
 * A fade is a length in seconds, not a pair of timestamps, so it survives the
 * segment being dragged and only has to be clamped when it stops fitting.
 */

export type FadeKind = "in" | "out";

/** A stretch of source with the fades that apply to it. */
export interface FadeRange {
  duration: number;
  fadeIn?: number;
  fadeOut?: number;
}

/** What a fade click would do: which segment, and the length to set. */
export interface FadeIntent {
  index: number;
  /** Zero removes the fade that is already there. */
  duration: number;
}

const seconds = (n: number) => n.toFixed(3);

/**
 * Where a fade click at `time` lands, or null when no segment can take it.
 *
 * Each fade is a toggle: a segment that already has one gives back a zero
 * length, meaning remove it, from anywhere inside that segment.
 *
 * Which segment owns a time on a cut differs by kind, so this cannot use
 * `findSegmentAt`, which always answers with the earlier of the two.
 */
export function fadeIntent(
  segments: SegmentLike[],
  time: number,
  kind: FadeKind,
): FadeIntent | null {
  const holds = (s: SegmentLike) =>
    time >= s.sourceStart && time <= s.sourceEnd;
  const index =
    kind === "in" ? segments.findIndex(holds) : segments.findLastIndex(holds);
  if (index === -1) return null;

  const segment = segments[index];
  if ((kind === "in" ? segment.fadeIn : segment.fadeOut) != null) {
    return { index, duration: 0 };
  }

  const duration =
    kind === "in" ? time - segment.sourceStart : segment.sourceEnd - time;

  return duration >= MIN_FADE_DURATION ? { index, duration } : null;
}

/** A copy of `segment` with one fade set, or dropped when `duration` is zero. */
export function withFade<T extends SegmentLike>(
  segment: T,
  kind: FadeKind,
  duration: number,
): T {
  const fade = duration || undefined;
  return kind === "in"
    ? { ...segment, fadeIn: fade }
    : { ...segment, fadeOut: fade };
}

/**
 * Fades cut back to fit the segment they are on.
 *
 * A segment dragged shorter than its own fade would otherwise encode as a clip
 * that never reaches full brightness. Returns the segment itself when nothing
 * needed cutting, so mapping this over a list leaves untouched entries alone.
 */
export function clampFades<T extends SegmentLike>(segment: T): T {
  const duration = segment.sourceEnd - segment.sourceStart;
  const fadeIn = fitFade(segment.fadeIn, duration);
  const fadeOut = fitFade(segment.fadeOut, duration);

  if (fadeIn === segment.fadeIn && fadeOut === segment.fadeOut) return segment;
  return { ...segment, fadeIn, fadeOut };
}

function fitFade(fade: number | undefined, duration: number) {
  if (fade == null) return undefined;
  const fitted = clamp(fade, duration);
  return fitted >= MIN_FADE_DURATION ? fitted : undefined;
}

/**
 * The `fade`/`afade` filters for one range.
 *
 * Offsets are relative to the range, so they only hold while these run ahead of
 * any `setpts`/`atempo` retiming.
 */
export function fadeFilters(
  { duration, fadeIn, fadeOut }: FadeRange,
  name: "fade" | "afade" = "fade",
): string[] {
  const filters: string[] = [];

  if (fadeIn) filters.push(`${name}=t=in:st=0:d=${seconds(fadeIn)}`);
  if (fadeOut) {
    const start = Math.max(0, duration - fadeOut);
    filters.push(`${name}=t=out:st=${seconds(start)}:d=${seconds(fadeOut)}`);
  }

  return filters;
}

/**
 * What a fade leaves of the picture and the sound at `time`, from 0 to 1.
 *
 * Overlapping fades multiply, the way two chained `fade` filters do, so the
 * preview matches what the export will produce.
 *
 * Past the end of a segment the level holds whatever that segment left, because
 * playback runs on for a frame or two past a cut before the handler catches it,
 * and snapping back to full there reads as a flash.
 */
export function fadeGainAt(segments: SegmentLike[], time: number): number {
  const segment =
    findSegmentAt(segments, time) ??
    segments.findLast((s) => time > s.sourceEnd);
  if (!segment) return 1;

  const { fadeIn, fadeOut } = segment;
  let gain = 1;

  if (fadeIn) gain *= clamp((time - segment.sourceStart) / fadeIn, 1);
  if (fadeOut) gain *= clamp((segment.sourceEnd - time) / fadeOut, 1);

  return gain;
}
