import { describe, it, expect } from "vitest";
import { validateRangeResponse } from "@/lib/rangeValidation";
import { legacyLicenseUsable } from "@/services/unifiedOfflineVideo";
import { isAllowedMediaUrl } from "../../supabase/functions/_shared/downloadPolicy";

describe("resume range validation", () => {
  const base = { contentLength: "500", requestedStart: 500, expectedTotal: 1000 };
  it("accepts exact 206 continuation", () => {
    expect(validateRangeResponse({ ...base, status: 206, contentRange: "bytes 500-999/1000" })).toEqual({ ok: true, total: 1000 });
  });
  it("rejects 200 when resuming (would append whole file)", () => {
    expect(validateRangeResponse({ ...base, status: 200, contentRange: null }).ok).toBe(false);
  });
  it("rejects wrong start offset", () => {
    expect(validateRangeResponse({ ...base, status: 206, contentRange: "bytes 0-999/1000", contentLength: "1000" }).ok).toBe(false);
  });
  it("rejects changed total or etag", () => {
    expect(validateRangeResponse({ ...base, status: 206, contentRange: "bytes 500-1199/1200", contentLength: "700" }).ok).toBe(false);
    expect(validateRangeResponse({ ...base, status: 206, contentRange: "bytes 500-999/1000", etag: "b", expectedEtag: "a" }).ok).toBe(false);
  });
  it("rejects length mismatch and truncated range", () => {
    expect(validateRangeResponse({ ...base, status: 206, contentRange: "bytes 500-999/1000", contentLength: "10" }).ok).toBe(false);
    expect(validateRangeResponse({ ...base, status: 206, contentRange: "bytes 500-800/1000", contentLength: "301" }).ok).toBe(false);
  });
  it("fresh download needs a known size", () => {
    expect(validateRangeResponse({ status: 200, contentRange: null, contentLength: null, requestedStart: 0 }).ok).toBe(false);
  });
});

describe("legacy license ownership", () => {
  const now = 1000;
  it("requires matching owner and unexpired", () => {
    expect(legacyLicenseUsable({ owner: "u1:p1", expiresAt: 2000 }, "u1:p1", now)).toBe(true);
    expect(legacyLicenseUsable({ owner: "u1:p1", expiresAt: 2000 }, "u2:p1", now)).toBe(false);
    expect(legacyLicenseUsable({ expiresAt: 2000 }, "u1:p1", now)).toBe(false);
    expect(legacyLicenseUsable({ owner: "u1:p1", expiresAt: 500 }, "u1:p1", now)).toBe(false);
    expect(legacyLicenseUsable({ owner: "u1:p1", expiresAt: 2000 }, null, now)).toBe(false);
  });
});

describe("media host allowlist", () => {
  it("allows exact and dot-boundary subdomains over https", () => {
    expect(isAllowedMediaUrl("https://hoyeehsync.nyc3.cdn.digitaloceanspaces.com/a.mp4")).toBe(true);
  });
  it("blocks lookalike, http, credentials, ports", () => {
    expect(isAllowedMediaUrl("https://evildigitaloceanspaces.com/a.mp4")).toBe(false);
    expect(isAllowedMediaUrl("https://digitaloceanspaces.com.evil.io/a.mp4")).toBe(false);
    expect(isAllowedMediaUrl("http://x.digitaloceanspaces.com/a.mp4")).toBe(false);
    expect(isAllowedMediaUrl("https://u:p@x.digitaloceanspaces.com/a.mp4")).toBe(false);
    expect(isAllowedMediaUrl("https://x.digitaloceanspaces.com:8443/a.mp4")).toBe(false);
    expect(isAllowedMediaUrl("javascript:alert(1)")).toBe(false);
  });
});
