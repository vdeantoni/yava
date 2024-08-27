import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const isMobile =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function secondsToDuration(seconds: number, trimLeft = false): string {
  seconds = Math.round(seconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor((seconds % 3600) % 60);

  const parts = [h, m, s].map((p) => String(p).padStart(2, "0"));

  let value = parts.join(":");

  if (trimLeft) {
    value = value.replace(/00:/g, "");
  }

  return value;
}
