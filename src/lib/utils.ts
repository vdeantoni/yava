import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const isMobile =
  typeof navigator !== "undefined" &&
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function secondsToDuration(
  seconds: number,
  options: { trimLeft?: boolean; ms?: boolean; compact?: boolean } = {},
): string {
  const ms = Math.ceil((seconds % 1) * 1000);

  seconds = Math.floor(seconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor((seconds % 3600) % 60);

  const parts = options?.compact ? [m, s] : [h, m, s];
  const formatted = parts.map((p) => String(p).padStart(2, "0"));

  if (options?.ms) {
    formatted.push(String(ms).padStart(3, "0"));
  }

  let value = formatted.join(":");

  if (options?.trimLeft) {
    value = value.replace(/00:/g, "");
  }

  return value;
}

export function durationToSeconds(duration: string): number {
  const parts = duration.split(":");

  if (parts.length === 4) {
    // HH:MM:SS:mmm
    return (
      parseInt(parts[0] || "0", 10) * 3600 +
      parseInt(parts[1] || "0", 10) * 60 +
      parseInt(parts[2] || "0", 10) +
      parseInt(parts[3] || "0", 10) / 1000
    );
  }

  if (parts.length === 3) {
    // Disambiguate: MM:SS:mmm (last part 3 digits) vs HH:MM:SS (all 2 digits)
    if (parts[2].length === 3) {
      // MM:SS:mmm
      return (
        parseInt(parts[0] || "0", 10) * 60 +
        parseInt(parts[1] || "0", 10) +
        parseInt(parts[2] || "0", 10) / 1000
      );
    }
    // HH:MM:SS
    return (
      parseInt(parts[0] || "0", 10) * 3600 +
      parseInt(parts[1] || "0", 10) * 60 +
      parseInt(parts[2] || "0", 10)
    );
  }

  // MM:SS
  return (
    parseInt(parts[0] || "0", 10) * 60 + parseInt(parts[1] || "0", 10)
  );
}

/** Minimum distance from a segment edge to allow a slice (seconds). */
export const MIN_SLICE_DISTANCE = 0.5;

/** Tolerance for matching a time to a segment during playback (seconds). */
export const PLAYBACK_TOLERANCE = 0.05;

/** Tolerance for detecting cursor at segment end for play-restart (seconds). */
export const RESTART_TOLERANCE = 0.1;

interface SegmentLike {
  sourceStart: number;
  sourceEnd: number;
}

/** Find the index of the segment containing `time` (within optional tolerance). Returns -1 if none. */
export function findSegmentIndexAt<T extends SegmentLike>(
  segments: T[],
  time: number,
  tolerance = 0,
): number {
  return segments.findIndex(
    (s) =>
      time >= s.sourceStart - tolerance && time <= s.sourceEnd + tolerance,
  );
}

/** Find the segment containing `time` (within optional tolerance). */
export function findSegmentAt<T extends SegmentLike>(
  segments: T[],
  time: number,
  tolerance = 0,
): T | undefined {
  const idx = findSegmentIndexAt(segments, time, tolerance);
  return idx === -1 ? undefined : segments[idx];
}

/** Find the nearest segment boundary (sourceStart or sourceEnd) to `time`. */
export function snapToNearestSegmentBoundary(
  segments: SegmentLike[],
  time: number,
  fallback = 0,
): number {
  let nearest = fallback;
  let minDist = Infinity;
  for (const seg of segments) {
    for (const edge of [seg.sourceStart, seg.sourceEnd]) {
      const dist = Math.abs(time - edge);
      if (dist < minDist) {
        minDist = dist;
        nearest = edge;
      }
    }
  }
  return nearest;
}
