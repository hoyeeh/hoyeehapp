import { describe, expect, it, vi } from "vitest";
import {
  generatePairingCode,
  generateReceiverSecret,
  isSafeMediaUrl,
  sha256Hex,
  validateCommand,
} from "../../supabase/functions/cast-signaling/protocol";
import { CastAckTracker } from "@/lib/castAckTracker";

describe("cast-signaling protocol", () => {
  it("pairing codes and receiver secrets are random and well-formed", () => {
    const codes = new Set(Array.from({ length: 200 }, generatePairingCode));
    expect(codes.size).toBeGreaterThan(195);
    const s1 = generateReceiverSecret();
    const s2 = generateReceiverSecret();
    expect(s1).not.toBe(s2);
    expect(s1.length).toBeGreaterThanOrEqual(32);
  });

  it("hashes secrets deterministically (server stores only the hash)", async () => {
    const s = generateReceiverSecret();
    expect(await sha256Hex(s)).toBe(await sha256Hex(s));
    expect(await sha256Hex(s)).not.toContain(s);
  });

  it("rejects unsafe media URLs and unknown commands", () => {
    expect(isSafeMediaUrl("https://cdn.example.com/a.mp4")).toBe(true);
    expect(isSafeMediaUrl("http://cdn.example.com/a.mp4")).toBe(false);
    expect(isSafeMediaUrl("javascript:alert(1)")).toBe(false);
    expect(validateCommand("RM_RF", {}).ok).toBe(false);
    expect(validateCommand("LOAD", { url: "javascript:1" }).ok).toBe(false);
    expect(validateCommand("SEEK", { time: -5 }).ok).toBe(false);
    expect(validateCommand("PLAY", {}).ok).toBe(true);
  });
});

describe("CastAckTracker", () => {
  it("resolves only on the exact seq, including ACK-before-wait races", async () => {
    const t = new CastAckTracker(1000);
    t.observe({ lastAckedSeq: 3, lastAckStatus: "success", commandSeq: 3 });
    await expect(t.wait(3)).resolves.toMatchObject({ acked: true });
  });

  it("never treats a later ACK as success for an earlier command", async () => {
    const t = new CastAckTracker(1000);
    const p = t.wait(4);
    t.observe({ lastAckedSeq: 5, lastAckStatus: "success", commandSeq: 5 });
    const r = await p;
    expect(r.acked).toBe(false);
    expect(r.superseded).toBe(true);
  });

  it("surfaces receiver errors and times out", async () => {
    vi.useFakeTimers();
    const t = new CastAckTracker(500);
    const err = t.wait(7);
    t.observe({ lastAckedSeq: 7, lastAckStatus: "error", lastAckError: "MEDIA_ERR", commandSeq: 7 });
    expect(await err).toMatchObject({ acked: false, error: "MEDIA_ERR" });
    const slow = t.wait(8);
    vi.advanceTimersByTime(600);
    expect(await slow).toMatchObject({ acked: false, timedOut: true });
    vi.useRealTimers();
  });
});
