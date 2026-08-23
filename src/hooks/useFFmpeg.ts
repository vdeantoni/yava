import { useAppStore } from "@/store.tsx";
import { useEffect, useState } from "react";
import { toBlobURL } from "@ffmpeg/util";

type CoreFile = "ffmpeg-core.js" | "ffmpeg-core.wasm" | "ffmpeg-core.worker.js";

// unpkg gzips these and sends no Content-Length, so @ffmpeg/util reports
// total: -1 and can't work out progress on its own. The sizes below are the
// decompressed bytes that `received` counts, so re-measure both builds when
// bumping the version. Switching to a CDN that does send Content-Length would
// not help: it reports the compressed length, which `received` overshoots.
const CORE: Record<
  "st" | "mt",
  { baseURL: string; sizes: Partial<Record<CoreFile, number>> }
> = {
  st: {
    baseURL: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm",
    sizes: {
      "ffmpeg-core.js": 114494,
      "ffmpeg-core.wasm": 32129114,
    },
  },
  mt: {
    baseURL: "https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm",
    sizes: {
      "ffmpeg-core.js": 132588,
      "ffmpeg-core.wasm": 32609891,
      "ffmpeg-core.worker.js": 2817,
    },
  },
};

export const supportsMultithreading =
  typeof SharedArrayBuffer !== "undefined" &&
  typeof crossOriginIsolated !== "undefined" &&
  crossOriginIsolated;

type LoadProgressCallback = (progress: { [name: string]: number }) => void;

export const useFFmpeg = (cb: LoadProgressCallback) => {
  const { ffmpeg, setMultithreading } = useAppStore();

  const [progress, setProgress] = useState<{ [name: string]: number }>({});

  useEffect(() => {
    cb(progress);
  }, [progress, cb]);

  const load = async () => {
    if (ffmpeg.loaded) {
      return;
    }

    const mt = supportsMultithreading;
    setMultithreading(mt);

    setProgress({});

    const { baseURL, sizes } = mt ? CORE.mt : CORE.st;

    const loadFile = (name: CoreFile, mimeType: string) =>
      toBlobURL(`${baseURL}/${name}`, mimeType, true, ({ received = 0 }) => {
        const total = sizes[name];
        if (!total) return;
        const pct = Math.min(100, Math.round((received / total) * 100));
        // Bail when the rounded value is unchanged. @ffmpeg/util fires this per
        // chunk, so a 32MB download would otherwise re-render on every one of
        // ~1000 reads to report at most 101 distinct values.
        setProgress((state) =>
          state[name] === pct ? state : { ...state, [name]: pct },
        );
      });

    await ffmpeg.load({
      coreURL: await loadFile("ffmpeg-core.js", "text/javascript"),
      wasmURL: await loadFile("ffmpeg-core.wasm", "application/wasm"),
      workerURL: mt
        ? await loadFile("ffmpeg-core.worker.js", "text/javascript")
        : undefined,
    });
  };

  return {
    load,
  };
};
