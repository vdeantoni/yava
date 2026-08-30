import { describe, it, expect } from "vitest";
import {
  CORE,
  loadCore,
  type CoreFile,
  type LoadableFFmpeg,
  type ToBlobURL,
} from "./load-core";

interface FakeOptions {
  /** Resolve each fetch only when the returned release function is called. */
  manual?: boolean;
  failFetch?: CoreFile;
  /** Bytes to report, in order, for every fetched file. */
  chunks?: number[];
}

function fakes(options: FakeOptions = {}) {
  const calls: string[] = [];
  const pending: (() => void)[] = [];
  let loadCount = 0;

  const ffmpeg: LoadableFFmpeg = {
    loaded: false,
    async load(config) {
      loadCount++;
      calls.push(
        `load ${["coreURL", "wasmURL", "workerURL"]
          .filter((k) => config[k as keyof typeof config])
          .join(",")}`,
      );
      return true;
    },
  };

  const toBlobURL: ToBlobURL = (url, _mime, _report, onProgress) => {
    const name = url.split("/").pop()!;
    calls.push(`fetch ${name}`);
    for (const received of options.chunks ?? []) onProgress({ received });

    if (options.failFetch && url.endsWith(options.failFetch)) {
      return Promise.reject(new Error(`network error on ${name}`));
    }
    if (!options.manual) return Promise.resolve(`blob:${name}`);
    return new Promise((resolve) =>
      pending.push(() => resolve(`blob:${name}`)),
    );
  };

  return {
    ffmpeg,
    toBlobURL,
    calls,
    releaseAll: () => pending.splice(0).forEach((r) => r()),
    loadCount: () => loadCount,
  };
}

describe("loadCore", () => {
  it("fetches the three multithreaded files and hands them to load", async () => {
    const f = fakes();

    await loadCore({
      ffmpeg: f.ffmpeg,
      multithreading: true,
      toBlobURL: f.toBlobURL,
    });

    expect(f.calls).toEqual([
      "fetch ffmpeg-core.js",
      "fetch ffmpeg-core.wasm",
      "fetch ffmpeg-core.worker.js",
      "load coreURL,wasmURL,workerURL",
    ]);
  });

  it("leaves the worker out of a single-threaded load", async () => {
    const f = fakes();

    await loadCore({
      ffmpeg: f.ffmpeg,
      multithreading: false,
      toBlobURL: f.toBlobURL,
    });

    expect(f.calls).toEqual([
      "fetch ffmpeg-core.js",
      "fetch ffmpeg-core.wasm",
      "load coreURL,wasmURL",
    ]);
  });

  it("fetches from the pinned core version", async () => {
    const urls: string[] = [];
    const f = fakes();
    const spy: ToBlobURL = (url, m, r, p) => {
      urls.push(url);
      return f.toBlobURL(url, m, r, p);
    };

    await loadCore({ ffmpeg: f.ffmpeg, multithreading: true, toBlobURL: spy });

    expect(urls.every((u) => u.startsWith(CORE.mt.baseURL))).toBe(true);
  });

  it("does nothing when the instance is already loaded", async () => {
    const f = fakes();
    f.ffmpeg.loaded = true;

    await loadCore({
      ffmpeg: f.ffmpeg,
      multithreading: true,
      toBlobURL: f.toBlobURL,
    });

    expect(f.calls).toEqual([]);
  });

  it("loads once when several callers ask at the same time", async () => {
    const f = fakes({ manual: true });
    const opts = {
      ffmpeg: f.ffmpeg,
      multithreading: true,
      toBlobURL: f.toBlobURL,
    };

    const first = loadCore(opts);
    const second = loadCore(opts);
    const third = loadCore(opts);
    f.releaseAll();
    await Promise.all([first, second, third]);

    // Without the guard this fetches the 32MB wasm three times.
    expect(f.calls.filter((c) => c === "fetch ffmpeg-core.wasm")).toHaveLength(
      1,
    );
    expect(f.loadCount()).toBe(1);
  });

  it("hands every concurrent caller the same promise", () => {
    const f = fakes({ manual: true });
    const opts = {
      ffmpeg: f.ffmpeg,
      multithreading: true,
      toBlobURL: f.toBlobURL,
    };

    expect(loadCore(opts)).toBe(loadCore(opts));
    f.releaseAll();
  });

  it("lets a retry through after a failure", async () => {
    const failing = fakes({ failFetch: "ffmpeg-core.wasm" });
    const opts = {
      ffmpeg: failing.ffmpeg,
      multithreading: true,
      toBlobURL: failing.toBlobURL,
    };

    await expect(loadCore(opts)).rejects.toThrow("network error");

    // The in-flight entry has to be cleared, or the next attempt would return
    // the rejected promise for ever.
    await expect(loadCore(opts)).rejects.toThrow("network error");
    expect(
      failing.calls.filter((c) => c === "fetch ffmpeg-core.wasm"),
    ).toHaveLength(2);
  });

  it("reports progress as a percentage of the known size", async () => {
    const wasm = CORE.mt.sizes["ffmpeg-core.wasm"]!;
    const seen: [CoreFile, number][] = [];
    const f = fakes({ chunks: [0, wasm / 4, wasm / 2, wasm] });

    await loadCore({
      ffmpeg: f.ffmpeg,
      multithreading: true,
      toBlobURL: f.toBlobURL,
      onProgress: (name, percent) => seen.push([name, percent]),
    });

    expect(seen.filter(([n]) => n === "ffmpeg-core.wasm")).toEqual([
      ["ffmpeg-core.wasm", 0],
      ["ffmpeg-core.wasm", 25],
      ["ffmpeg-core.wasm", 50],
      ["ffmpeg-core.wasm", 100],
    ]);
  });

  it("never reports more than 100, since the sizes are approximate", async () => {
    const wasm = CORE.mt.sizes["ffmpeg-core.wasm"]!;
    const seen: number[] = [];
    const f = fakes({ chunks: [wasm * 2] });

    await loadCore({
      ffmpeg: f.ffmpeg,
      multithreading: true,
      toBlobURL: f.toBlobURL,
      onProgress: (_name, percent) => seen.push(percent),
    });

    expect(Math.max(...seen)).toBe(100);
  });
});
