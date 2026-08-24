import { describe, test, expect, vi, afterEach } from "vitest";
import { fetchBlobWithProgress, formatBytes } from "./fetch-progress";

/** Split a byte length into fixed-size chunks of ascending values. */
function chunks(total: number, size: number): Uint8Array[] {
  const out: Uint8Array[] = [];
  for (let sent = 0; sent < total; sent += size) {
    out.push(new Uint8Array(Math.min(size, total - sent)).fill(1));
  }
  return out;
}

/**
 * Minimal stand-in for a streaming Response. Only the members
 * fetchBlobWithProgress reads are implemented.
 */
function stubResponse({
  body = chunks(1000, 100),
  contentLength,
  contentType = "video/mp4",
  ok = true,
  status = 200,
  streaming = true,
}: {
  body?: Uint8Array[];
  contentLength?: string | null;
  contentType?: string | null;
  ok?: boolean;
  status?: number;
  streaming?: boolean;
} = {}) {
  const headers = new Headers();
  if (contentType !== null) headers.set("Content-Type", contentType);
  if (contentLength != null) headers.set("Content-Length", contentLength);

  const queue = [...body];
  const blobBytes = body.reduce((n, c) => n + c.byteLength, 0);

  return {
    ok,
    status,
    headers,
    body: streaming
      ? {
          getReader: () => ({
            read: async () =>
              queue.length
                ? { done: false, value: queue.shift()! }
                : { done: true, value: undefined },
          }),
        }
      : null,
    blob: async () =>
      new Blob([new Uint8Array(blobBytes)], { type: "video/mp4" }),
  } as unknown as Response;
}

function mockFetch(response: Response | Error) {
  const fn = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("formatBytes", () => {
  test("uses bytes below a kilobyte", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
  });

  test("uses kilobytes below a megabyte", () => {
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(30258)).toBe("30 KB");
  });

  test("uses megabytes with one decimal above that", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
    expect(formatBytes(32129114)).toBe("30.6 MB");
  });
});

describe("fetchBlobWithProgress", () => {
  test("returns the assembled blob", async () => {
    mockFetch(stubResponse({ contentLength: "1000" }));
    const blob = await fetchBlobWithProgress("https://ex.com/a.mp4", () => {});
    expect(blob.size).toBe(1000);
  });

  test("preserves Content-Type, which callers gate on", async () => {
    // A Blob built from chunks has an empty type unless it is set explicitly,
    // and both callers check blob.type.startsWith("video/").
    mockFetch(stubResponse({ contentLength: "1000" }));
    const blob = await fetchBlobWithProgress("https://ex.com/a.mp4", () => {});
    expect(blob.type).toBe("video/mp4");
  });

  test("falls back to an empty type when the header is absent", async () => {
    mockFetch(stubResponse({ contentType: null, contentLength: "1000" }));
    const blob = await fetchBlobWithProgress("https://ex.com/a.mp4", () => {});
    expect(blob.type).toBe("");
  });

  test("throws on a non-ok status", async () => {
    mockFetch(stubResponse({ ok: false, status: 403 }));
    await expect(
      fetchBlobWithProgress("https://ex.com/a.mp4", () => {}),
    ).rejects.toThrow("HTTP 403");
  });

  test("reports a known total from Content-Length", async () => {
    mockFetch(stubResponse({ contentLength: "1000" }));

    const seen: number[] = [];
    await fetchBlobWithProgress("https://ex.com/a.mp4", (p) => {
      expect(p.total).toBe(1000);
      seen.push(p.received);
    });

    expect(seen.at(0)).toBe(0);
    expect(seen.at(-1)).toBe(1000);
  });

  test("reports a null total when Content-Length is missing", async () => {
    mockFetch(stubResponse({ contentLength: null }));

    const totals = new Set<number | null>();
    await fetchBlobWithProgress("https://ex.com/a.mp4", (p) =>
      totals.add(p.total),
    );

    expect([...totals]).toEqual([null]);
  });

  test.each([
    ["zero", "0"],
    ["negative", "-1"],
    ["non-numeric", "banana"],
  ])("treats a %s Content-Length as unknown", async (_label, value) => {
    mockFetch(stubResponse({ contentLength: value }));

    let total: number | null = 0;
    await fetchBlobWithProgress("https://ex.com/a.mp4", (p) => {
      total = p.total;
    });

    expect(total).toBeNull();
  });

  test("reaches exactly 100% of the reported total", async () => {
    mockFetch(stubResponse({ body: chunks(1000, 300), contentLength: "1000" }));

    let last = { received: 0, total: null as number | null };
    await fetchBlobWithProgress("https://ex.com/a.mp4", (p) => {
      last = p;
    });

    expect(last.received).toBe(last.total);
  });

  test("throttles callbacks to changes in the displayed percentage", async () => {
    // 2000 chunks would fire 2000 times unthrottled, to show 101 values.
    mockFetch(
      stubResponse({ body: chunks(200_000, 100), contentLength: "200000" }),
    );

    const onProgress = vi.fn();
    await fetchBlobWithProgress("https://ex.com/a.mp4", onProgress);

    expect(onProgress.mock.calls.length).toBeLessThanOrEqual(101);
    expect(onProgress.mock.calls.length).toBeGreaterThan(50);
  });

  test("still reports periodically when the total is unknown", async () => {
    // 2MB in 64KB chunks: throttled per 512KB, so a handful of updates.
    mockFetch(
      stubResponse({
        body: chunks(2 * 1024 * 1024, 64 * 1024),
        contentLength: null,
      }),
    );

    const onProgress = vi.fn();
    await fetchBlobWithProgress("https://ex.com/a.mp4", onProgress);

    expect(onProgress.mock.calls.length).toBeGreaterThan(1);
    expect(onProgress.mock.calls.length).toBeLessThan(10);
  });

  test("reports monotonically increasing byte counts", async () => {
    mockFetch(
      stubResponse({ body: chunks(50_000, 500), contentLength: "50000" }),
    );

    const seen: number[] = [];
    await fetchBlobWithProgress("https://ex.com/a.mp4", (p) =>
      seen.push(p.received),
    );

    const sorted = [...seen].sort((a, b) => a - b);
    expect(seen).toEqual(sorted);
  });

  test("handles a body with no readable stream", async () => {
    mockFetch(stubResponse({ streaming: false, body: chunks(400, 400) }));

    const onProgress = vi.fn();
    const blob = await fetchBlobWithProgress(
      "https://ex.com/a.mp4",
      onProgress,
    );

    expect(blob.size).toBe(400);
    expect(onProgress).toHaveBeenCalledWith({ received: 400, total: 400 });
  });

  test("passes the abort signal to fetch", async () => {
    const fn = mockFetch(stubResponse({ contentLength: "1000" }));
    const controller = new AbortController();

    await fetchBlobWithProgress(
      "https://ex.com/a.mp4",
      () => {},
      controller.signal,
    );

    expect(fn).toHaveBeenCalledWith("https://ex.com/a.mp4", {
      signal: controller.signal,
    });
  });

  test("propagates a rejected fetch", async () => {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    mockFetch(abort);

    await expect(
      fetchBlobWithProgress("https://ex.com/a.mp4", () => {}),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
