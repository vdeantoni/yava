/**
 * Why a `<video>` is not showing a picture, and what to say about it.
 *
 * Four states reach the player and only some of them are the browser's fault,
 * so the messages, the state names and the rule that tells them apart live
 * together here rather than in the component that happens to notice each one.
 */

/** A user-facing message, and the element's own account of itself beneath it. */
export interface MediaNotice {
  message: string;
  detail: string;
  /** An error is the browser's; a hint is something the reader can act on. */
  tone: "error" | "hint";
}

export const NO_FRAMES_MESSAGE =
  "This browser decoded no frames from this video, so there is no preview. Exporting still works, because FFmpeg decodes the file itself.";

export const NO_METADATA_MESSAGE =
  "This browser could not read this video and did not say why. The editor needs the video's details before it can open, so try a shorter or smaller clip.";

export const NOT_LOADED_MESSAGE =
  "Press play to load this video. This browser stops at the file's header and will not read the rest until you ask it to.";

/** `HTMLMediaElement.readyState`, in order. */
const READY_STATES = [
  "nothing",
  "metadata",
  "current-data",
  "future-data",
  "enough-data",
];

/** `HTMLMediaElement.networkState`, in order. */
const NETWORK_STATES = ["empty", "idle", "loading", "no-source"];

/** `MediaError.code`, which starts at 1. */
const ERROR_CODES = ["aborted", "network", "decode", "unsupported"];

/** `HAVE_METADATA`: duration and intrinsic size are known, but no frame is. */
const HAVE_METADATA = 1;

/** `NETWORK_IDLE`: a resource is selected and the element has stopped reading. */
const NETWORK_IDLE = 1;

/**
 * Turn an `HTMLMediaElement.error` code into something worth showing. The
 * numbers are the MediaError constants, which jsdom does not define: 1 aborted,
 * 2 network, 3 decode, 4 unsupported source. An unsupported codec often fires
 * with no code at all, so that case gets the codec message rather than a
 * generic one.
 */
export function describeMediaError(code: number | undefined): string {
  if (code === 1) return "Loading this video was interrupted.";
  if (code === 2) {
    return "This video could not be loaded. Check your connection and try again.";
  }
  return "This browser cannot decode this video. 10-bit and HDR footage usually has to be converted to 8-bit first.";
}

/**
 * Where the element got to, named rather than numbered. A failure that only
 * happens on one device has to be legible to whoever reads it off the screen,
 * and the raw enums say nothing on their own.
 */
export function mediaStateDetail(
  readyState: number,
  networkState: number,
): string {
  const ready = READY_STATES[readyState] ?? readyState;
  const network = NETWORK_STATES[networkState] ?? networkState;
  return `ready ${ready} · network ${network}`;
}

/** The same line for an element that did raise an error. */
export function mediaErrorDetail(code: number | undefined): string {
  if (code === undefined) return "error no-code";
  return `error ${ERROR_CODES[code - 1] ?? code}`;
}

/**
 * Why an element that reported its metadata is still showing nothing.
 *
 * Parked on the metadata with the network idle is not a failure at all: iOS
 * Safari clamps preload and reads no further until playback is requested by a
 * gesture, which no amount of asking from script substitutes for. Anything else
 * that got this far and produced no frame has a decoder that cannot cope.
 */
export function describeBlankPicture(
  readyState: number,
  networkState: number,
): MediaNotice {
  const detail = mediaStateDetail(readyState, networkState);

  if (readyState === HAVE_METADATA && networkState === NETWORK_IDLE) {
    return { message: NOT_LOADED_MESSAGE, detail, tone: "hint" };
  }

  return { message: NO_FRAMES_MESSAGE, detail, tone: "error" };
}
