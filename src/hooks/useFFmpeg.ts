import { useAppStore } from "@/store.tsx";
import { useEffect, useState } from "react";
import { toBlobURL } from "@ffmpeg/util";

const BASE_URL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
const BASE_URL_MT = "https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm";

const FILE_SIZE_MAP = {
  "ffmpeg-core.js": 114673,
  "ffmpeg-core.wasm": 32129114,
  "ffmpeg-core.worker.js": 2915,
};

const supportsMultithreading =
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

    const baseURL = mt ? BASE_URL_MT : BASE_URL;

    const updateProgress =
      (name: string, total: number) =>
      ({ received = 0 }) => {
        setProgress((state) => ({
          ...state,
          [name]: Math.round((received / total) * 100),
        }));
      };

    await ffmpeg.load({
      coreURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.js`,
        "text/javascript",
        true,
        updateProgress("ffmpeg-core.js", FILE_SIZE_MAP["ffmpeg-core.js"]),
      ),
      wasmURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.wasm`,
        "application/wasm",
        true,
        updateProgress("ffmpeg-core.wasm", FILE_SIZE_MAP["ffmpeg-core.wasm"]),
      ),
      workerURL: mt
        ? await toBlobURL(
            `${baseURL}/ffmpeg-core.worker.js`,
            "text/javascript",
            true,
            updateProgress(
              "ffmpeg-core.worker.js",
              FILE_SIZE_MAP["ffmpeg-core.worker.js"],
            ),
          )
        : undefined,
    });
  };

  return {
    load,
  };
};
