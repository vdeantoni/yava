export type CoreFile =
  | "ffmpeg-core.js"
  | "ffmpeg-core.wasm"
  | "ffmpeg-core.worker.js";

// unpkg gzips these and sends no Content-Length, so @ffmpeg/util reports
// total: -1 and can't work out progress on its own. The sizes below are the
// decompressed bytes that `received` counts, so re-measure both builds when
// bumping the version. Switching to a CDN that does send Content-Length would
// not help: it reports the compressed length, which `received` overshoots.
export const CORE: Record<
  "st" | "mt",
  { baseURL: string; sizes: Partial<Record<CoreFile, number>> }
> = {
  st: {
    baseURL: "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm",
    sizes: {
      "ffmpeg-core.js": 111804,
      "ffmpeg-core.wasm": 32232419,
    },
  },
  mt: {
    baseURL: "https://unpkg.com/@ffmpeg/core-mt@0.12.10/dist/esm",
    sizes: {
      "ffmpeg-core.js": 128947,
      "ffmpeg-core.wasm": 32718323,
      "ffmpeg-core.worker.js": 2115,
    },
  },
};

interface LoadConfig {
  coreURL: string;
  wasmURL: string;
  workerURL?: string;
}

/** The slice of the FFmpeg API loading needs. */
export interface LoadableFFmpeg {
  loaded: boolean;
  load(config: LoadConfig): Promise<boolean>;
}

/** `toBlobURL` from `@ffmpeg/util`, narrowed to how this module calls it. */
export type ToBlobURL = (
  url: string,
  mimeType: string,
  reportProgress: boolean,
  onProgress: (event: { received?: number }) => void,
) => Promise<string>;

export interface LoadCoreOptions {
  ffmpeg: LoadableFFmpeg;
  multithreading: boolean;
  toBlobURL: ToBlobURL;
  /** Fires per chunk, so callers that render this should drop repeats. */
  onProgress?: (name: CoreFile, percent: number) => void;
}

/**
 * One load per FFmpeg instance, however many callers ask for it. Keyed on the
 * instance rather than a module flag so a second load after `terminate()` still
 * works, and so tests get a fresh slate per fake.
 */
const inFlight = new WeakMap<LoadableFFmpeg, Promise<void>>();

export function loadCore(options: LoadCoreOptions): Promise<void> {
  const { ffmpeg } = options;
  if (ffmpeg.loaded) return Promise.resolve();

  const existing = inFlight.get(ffmpeg);
  if (existing) return existing;

  const started = fetchAndLoad(options).finally(() => inFlight.delete(ffmpeg));
  inFlight.set(ffmpeg, started);
  return started;
}

async function fetchAndLoad({
  ffmpeg,
  multithreading,
  toBlobURL,
  onProgress,
}: LoadCoreOptions): Promise<void> {
  const { baseURL, sizes } = multithreading ? CORE.mt : CORE.st;

  const fetchFile = (name: CoreFile, mimeType: string) =>
    toBlobURL(`${baseURL}/${name}`, mimeType, true, ({ received = 0 }) => {
      const total = sizes[name];
      if (!total) return;
      onProgress?.(name, Math.min(100, Math.round((received / total) * 100)));
    });

  // Three independent CDN fetches. Serializing them would put the 112KB js and
  // 2KB worker behind a full round trip each, after the 32MB wasm.
  const [coreURL, wasmURL, workerURL] = await Promise.all([
    fetchFile("ffmpeg-core.js", "text/javascript"),
    fetchFile("ffmpeg-core.wasm", "application/wasm"),
    multithreading
      ? fetchFile("ffmpeg-core.worker.js", "text/javascript")
      : undefined,
  ]);

  await ffmpeg.load({ coreURL, wasmURL, workerURL });
}
