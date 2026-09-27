import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf8");

describe("cast pairing auto-load regressions", () => {
  it("useUniversalCast sends LOAD payloads with canonical url field for the TV receiver", () => {
    const src = read("src/hooks/useUniversalCast.ts");
    expect(src).toMatch(/sendCommand\('LOAD',\s*\{[\s\S]*url:\s*videoUrl/);
    expect(src).toMatch(/videoUrl,\s*[\r\n\s]*title/);
  });

  it("CastToTVButton waits for a successful remote LOAD before showing success", () => {
    const src = read("src/components/cast/CastToTVButton.tsx");
    expect(src).toMatch(/const result = await cast\.loadVideo\(/);
    expect(src).toMatch(/if \(result\?\.success\)/);
    expect(src).toMatch(/Connected to TV but failed to launch video/);
  });

  it("MobileCastSheet only closes after the TV accepts the LOAD command", () => {
    const src = read("src/components/mobile/MobileCastSheet.tsx");
    expect(src).toMatch(/const result = await cast\.loadVideo\(/);
    expect(src).toMatch(/if \(result\?\.success\)/);
    expect(src).toMatch(/Connected to TV but failed to launch video/);
  });

  it("MobileVideoPlayer casts only via the popup with current time/duration and pauses on ACK", () => {
    const src = read("src/components/mobile/MobileVideoPlayer.tsx");
    expect(src).not.toMatch(/cast\.loadVideo\(/);
    expect(src).toMatch(/<MobileCastSheet[\s\S]*currentTime=\{currentTime\}[\s\S]*duration=\{duration\}[\s\S]*onCastStart=/);
  });

  it("VideoPlayer passes the resolved playback URL into CastToTVButton", () => {
    const src = read("src/components/VideoPlayer.tsx");
    expect(src).toMatch(/<CastToTVButton[\s\S]*videoUrl=\{getVideoSource\(\)\}/);
  });
});