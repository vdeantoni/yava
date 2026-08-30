import { useAppStore } from "@/store.tsx";
import { useShallow } from "zustand/react/shallow";
import { useEffect, useState } from "react";
import { toBlobURL } from "@ffmpeg/util";
import { loadCore } from "@/lib/load-core.ts";

export const supportsMultithreading =
  typeof SharedArrayBuffer !== "undefined" &&
  typeof crossOriginIsolated !== "undefined" &&
  crossOriginIsolated;

type LoadProgressCallback = (progress: { [name: string]: number }) => void;

export const useFFmpeg = (cb: LoadProgressCallback) => {
  const { ffmpeg, setMultithreading } = useAppStore(
    useShallow((s) => ({
      ffmpeg: s.ffmpeg,
      setMultithreading: s.setMultithreading,
    })),
  );

  const [progress, setProgress] = useState<{ [name: string]: number }>({});

  useEffect(() => {
    cb(progress);
  }, [progress, cb]);

  const load = () => {
    setMultithreading(supportsMultithreading);

    return loadCore({
      ffmpeg,
      multithreading: supportsMultithreading,
      toBlobURL,
      onProgress: (name, percent) =>
        // Bail when the rounded value is unchanged. @ffmpeg/util fires per
        // chunk, so a 32MB download would otherwise re-render on every one of
        // ~1000 reads to report at most 101 distinct values.
        setProgress((state) =>
          state[name] === percent ? state : { ...state, [name]: percent },
        ),
    });
  };

  return {
    load,
  };
};
