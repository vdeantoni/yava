import { useAppStore, type UrlEditState, type UrlSegment } from "@/store";
import { FLUSH_TOLERANCE, type SegmentLike } from "@/lib/utils";

const DEBOUNCE_MS = 500;

const roundMs = (n: number) => Math.round(n * 1000) / 1000;

// --- URL-safe base64 helpers ---

function toBase64Url(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str: string): string {
  let b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  return atob(b64);
}

// --- Encode / decode ---

export function encodeEditState(state: {
  sourceUrl: string | null;
  segments: SegmentLike[];
  cursorStart: number;
  cursorEnd: number;
  format: string;
  preset: string;
  frameRate: number;
  speed: number;
  noAudio: boolean;
}): string | null {
  const obj: UrlEditState = {};

  if (state.sourceUrl) obj.v = state.sourceUrl;

  // Only include segments if they differ from the single full-duration default
  const isDefaultSegments =
    state.segments.length === 1 &&
    Math.abs(state.segments[0].sourceStart - state.cursorStart) <
      FLUSH_TOLERANCE &&
    Math.abs(state.segments[0].sourceEnd - state.cursorEnd) < FLUSH_TOLERANCE &&
    state.segments[0].sourceStart === 0 &&
    !state.segments[0].fadeIn &&
    !state.segments[0].fadeOut;

  if (!isDefaultSegments && state.segments.length > 0) {
    obj.seg = state.segments.map((s): UrlSegment => {
      const start = roundMs(s.sourceStart);
      const end = roundMs(s.sourceEnd);
      // Both lengths travel together, so the tuple is either 2 or 4 long.
      if (!s.fadeIn && !s.fadeOut) return [start, end];
      return [start, end, roundMs(s.fadeIn ?? 0), roundMs(s.fadeOut ?? 0)];
    });
  }

  if (state.format !== "mp4") obj.fmt = state.format as UrlEditState["fmt"];
  if (state.preset !== "ultrafast")
    obj.pre = state.preset as UrlEditState["pre"];
  if (state.frameRate !== 30) obj.fps = state.frameRate;
  if (state.speed !== 1) obj.spd = state.speed;
  if (state.noAudio) obj.na = true;

  // All defaults — no hash needed
  if (Object.keys(obj).length === 0) return null;

  return toBase64Url(JSON.stringify(obj));
}

export function decodeEditState(hash: string): UrlEditState | null {
  try {
    const json = fromBase64Url(hash);
    const obj = JSON.parse(json);
    if (typeof obj !== "object" || obj === null) return null;

    const state: UrlEditState = {};

    if (typeof obj.v === "string") state.v = obj.v;

    if (Array.isArray(obj.seg)) {
      const segs: UrlSegment[] = [];
      for (const s of obj.seg) {
        if (
          Array.isArray(s) &&
          (s.length === 2 || s.length === 4) &&
          s.every((n) => typeof n === "number" && Number.isFinite(n))
        ) {
          segs.push(s as UrlSegment);
        }
      }
      if (segs.length > 0) state.seg = segs;
    }

    if (typeof obj.fmt === "string") state.fmt = obj.fmt as UrlEditState["fmt"];
    if (typeof obj.pre === "string") state.pre = obj.pre as UrlEditState["pre"];
    if (typeof obj.fps === "number") state.fps = obj.fps;
    if (typeof obj.spd === "number") state.spd = obj.spd;
    if (typeof obj.na === "boolean") state.na = obj.na;

    return Object.keys(state).length > 0 ? state : null;
  } catch {
    return null;
  }
}

// --- Parse initial URL state (called once at module level in NewVideo.tsx) ---

export function parseUrlEditState(): {
  videoUrl: string | null;
  editState: UrlEditState | null;
} {
  const params = new URLSearchParams(window.location.search);
  const paramV = params.get("v");

  const hash = window.location.hash.slice(1);
  const editState = hash ? decodeEditState(hash) : null;

  // ?v= takes priority over hash's v (it's the explicit entry point)
  const videoUrl = paramV || editState?.v || null;

  // Strip ?v= from URL now that it's consumed
  if (paramV) {
    params.delete("v");
    const qs = params.toString();
    const clean =
      window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
    window.history.replaceState({}, "", clean);
  }

  return { videoUrl, editState };
}

// --- Store subscription for URL sync ---

let timer: ReturnType<typeof setTimeout>;
let lastUrl = "";

const unsubscribe = useAppStore.subscribe((state) => {
  clearTimeout(timer);

  // Clear URL immediately on reset (no debounce needed)
  if (!state.sourceUrl) {
    const url = window.location.pathname;
    if (url !== lastUrl) {
      lastUrl = url;
      window.history.replaceState({}, "", url);
    }
    return;
  }

  timer = setTimeout(() => {
    const encoded = encodeEditState(state);
    const newHash = encoded ? `#${encoded}` : "";
    const url = window.location.pathname + window.location.search + newHash;
    if (url !== lastUrl) {
      lastUrl = url;
      window.history.replaceState({}, "", url);
    }
  }, DEBOUNCE_MS);
});

// Clean up on HMR so stale subscriptions don't persist
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    clearTimeout(timer);
    unsubscribe();
  });
}
