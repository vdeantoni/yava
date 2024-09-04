import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const isMobile =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function secondsToDuration(
  seconds: number,
  options: { trimLeft?: boolean; ms?: boolean } = {},
): string {
  const ms = Math.ceil((seconds % 1) * 1000);

  seconds = Math.floor(seconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor((seconds % 3600) % 60);

  const parts = [h, m, s].map((p) => String(p).padStart(2, "0"));

  if (options?.ms) {
    parts.push(String(ms).padStart(3, "0"));
  }

  let value = parts.join(":");

  if (options?.trimLeft) {
    value = value.replace(/00:/g, "");
  }

  return value;
}

export function durationToSeconds(duration: string): number {
  const parts = duration.split(":");

  const value =
    parseInt(parts[0] || "0", 10) * 3600 +
    parseInt(parts[1] || "0", 10) * 60 +
    parseInt(parts[2] || "0", 10) +
    parseInt(parts[3] || "0", 10) / 1000;

  return value;
}
