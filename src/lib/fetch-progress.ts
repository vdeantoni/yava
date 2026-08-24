export interface DownloadProgress {
  /** Bytes received so far. */
  received: number;
  /** Total bytes, or null when the response has no usable Content-Length. */
  total: number | null;
}

/** Notify at most once per 1% when the size is known, else once per 512KB. */
const UNKNOWN_TOTAL_STEP = 512 * 1024;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Fetch a URL as a Blob, reporting bytes as they arrive.
 *
 * Content-Length is CORS-safelisted, so `total` is readable even cross-origin
 * without the server opting in via Access-Control-Expose-Headers. It is null
 * for chunked responses, and callers should show an indeterminate state rather
 * than a percentage in that case.
 */
export async function fetchBlobWithProgress(
  url: string,
  onProgress: (progress: DownloadProgress) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  // Carried over deliberately: callers gate on blob.type.startsWith("video/"),
  // and a Blob assembled from chunks has an empty type unless it is set here.
  const type = response.headers.get("Content-Type") ?? "";

  const header = Number(response.headers.get("Content-Length"));
  const total = Number.isFinite(header) && header > 0 ? header : null;

  if (!response.body) {
    // No streaming support. Report the size once the body has landed.
    const blob = await response.blob();
    onProgress({ received: blob.size, total: total ?? blob.size });
    return blob;
  }

  const reader = response.body.getReader();
  const chunks: BlobPart[] = [];
  let received = 0;

  // Throttle by displayed value. The reader fires once per chunk, so a 30MB
  // download would otherwise push ~1000 React updates to show ~100 numbers.
  let lastStep = -1;
  const notify = () => {
    const step = total
      ? Math.round((received / total) * 100)
      : Math.floor(received / UNKNOWN_TOTAL_STEP);
    if (step === lastStep) return;
    lastStep = step;
    onProgress({ received, total });
  };

  notify();

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    notify();
  }

  return new Blob(chunks, { type });
}
