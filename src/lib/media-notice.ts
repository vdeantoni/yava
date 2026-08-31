/**
 * Why a `<video>` is not showing a picture, and what to say about it.
 *
 * Four states reach the player and only some of them are the browser's fault,
 * so the messages, the state names and the rules that tell them apart live
 * together here rather than in the component that happens to notice each one.
 * Every notice is built by one of the three constructors below.
 */

/** A user-facing message, and the element's own account of itself beneath it. */
export interface MediaNotice {
  message: string;
  detail: string;
  /** An error is the browser's; a hint is something the reader can act on. */
  tone: "error" | "hint";
}

const NO_FRAMES_MESSAGE =
  "This browser decoded no frames from this video, so there is no preview. Exporting still works, because FFmpeg decodes the file itself.";

const NO_METADATA_MESSAGE =
  "This browser could not read this video and did not say why. The editor needs the video's details before it can open, so try a shorter or smaller clip.";

const NOT_LOADED_MESSAGE =
  "Press play to load this video. This browser stopped after reading its details.";

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
 * Where the element got to, named rather than numbered. A failure that only
 * happens on one device has to be legible to whoever reads it off the screen,
 * and the raw enums say nothing on their own.
 */
function stateDetail(readyState: number, networkState: number): string {
  const ready = READY_STATES[readyState] ?? readyState;
  const network = NETWORK_STATES[networkState] ?? networkState;
  return `ready ${ready} · network ${network}`;
}

/**
 * The element raised an error of its own. The numbers are the MediaError
 * constants, which jsdom does not define: 1 aborted, 2 network, 3 decode,
 * 4 unsupported source. An unsupported codec often fires with no code at all,
 * so that case gets the codec message rather than a generic one.
 */
export function describeMediaError(code: number | undefined): MediaNotice {
  const detail =
    code === undefined
      ? "error no-code"
      : `error ${ERROR_CODES[code - 1] ?? code}`;

  if (code === 1) {
    return {
      message: "Loading this video was interrupted.",
      detail,
      tone: "error",
    };
  }
  if (code === 2) {
    return {
      message:
        "This video could not be loaded. Check your connection and try again.",
      detail,
      tone: "error",
    };
  }
  return {
    message:
      "This browser cannot decode this video. 10-bit and HDR footage usually has to be converted to 8-bit first.",
    detail,
    tone: "error",
  };
}

/** The element never reported its metadata, and never said why. */
export function describeMissingMetadata(
  readyState: number,
  networkState: number,
): MediaNotice {
  return {
    message: NO_METADATA_MESSAGE,
    detail: stateDetail(readyState, networkState),
    tone: "error",
  };
}

/**
 * Why an element that reported its metadata is still showing nothing.
 *
 * Stopping at the metadata with the network idle is not a failure: the element
 * has read the header and is waiting to be asked for the rest, which on iOS
 * Safari only a play gesture does. Anything else that got this far and produced
 * no frame has a decoder that cannot cope.
 */
export function describeBlankPicture(
  readyState: number,
  networkState: number,
): MediaNotice {
  const detail = stateDetail(readyState, networkState);

  if (readyState === HAVE_METADATA && networkState === NETWORK_IDLE) {
    return { message: NOT_LOADED_MESSAGE, detail, tone: "hint" };
  }

  return { message: NO_FRAMES_MESSAGE, detail, tone: "error" };
}
