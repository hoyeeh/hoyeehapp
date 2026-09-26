/**
 * Validates a (possibly resumed) download response so partial bytes are only
 * appended when the server returned exactly the requested range of the same file.
 */
export interface RangeCheckInput {
  status: number;
  contentRange: string | null;
  contentLength: string | null;
  etag?: string | null;
  requestedStart: number;
  /** Total size recorded when the download began (required when resuming). */
  expectedTotal?: number;
  expectedEtag?: string;
}
export type RangeCheck = { ok: true; total: number } | { ok: false; reason: string };

export function validateRangeResponse(i: RangeCheckInput): RangeCheck {
  const len = i.contentLength != null ? Number(i.contentLength) : NaN;
  if (i.requestedStart === 0) {
    if (i.status !== 200 && i.status !== 206) return { ok: false, reason: "Unexpected response" };
    if (i.status === 206) {
      const m = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(i.contentRange || "");
      if (!m || Number(m[1]) !== 0) return { ok: false, reason: "Unexpected range" };
      return { ok: true, total: Number(m[3]) };
    }
    if (!Number.isFinite(len) || len <= 0) return { ok: false, reason: "Unknown file size" };
    return { ok: true, total: len };
  }
  if (i.status !== 206) return { ok: false, reason: "Server ignored resume; restarting download" };
  const m = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(i.contentRange || "");
  if (!m) return { ok: false, reason: "Missing Content-Range on resume" };
  const start = Number(m[1]), end = Number(m[2]), total = Number(m[3]);
  if (start !== i.requestedStart) return { ok: false, reason: "Resume offset mismatch" };
  if (end !== total - 1 || end < start) return { ok: false, reason: "Incomplete resume range" };
  if (i.expectedTotal && total !== i.expectedTotal) return { ok: false, reason: "File changed on server" };
  if (i.expectedEtag && i.etag && i.etag !== i.expectedEtag) return { ok: false, reason: "File changed on server" };
  if (Number.isFinite(len) && len !== end - start + 1) return { ok: false, reason: "Length mismatch" };
  return { ok: true, total };
}
