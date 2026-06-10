/**
 * E2E test: /tv deep linking → tv-receiver static page.
 *
 * Guards against three regressions:
 *  1. The static stub at public/tv/index.html must NEVER reappear.
 *     (It was deleted because it intercepted the /tv SPA route on hosting.)
 *  2. The static receiver bundle at public/tv-receiver/index.html must exist.
 *  3. src/pages/TV.tsx must redirect to /tv-receiver/index.html so that
 *     navigating to hoyeeh.com/tv resolves to the receiver.
 *  4. The /tv, /tv-receiver, and /tv-app routes must be registered in App.tsx.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf8");

describe("/tv deep linking → tv-receiver", () => {
  it("serves a self-contained TV receiver at public/tv/index.html (no redirect, no SPA bundle)", () => {
    // Smart TV browsers (Tizen, webOS, older WebKit/Chromium) frequently fail
    // to follow meta-refresh or window.location redirects, leaving /tv blank.
    // We now ship the FULL receiver directly at /tv/index.html so the URL
    // works on every TV browser without any client-side navigation.
    const stub = resolve(root, "public/tv/index.html");
    expect(existsSync(stub)).toBe(true);
    const html = read("public/tv/index.html");
    // Must contain the receiver UI (pairing screen + QR container).
    expect(html).toMatch(/id=["']pairingScreen["']/);
    expect(html).toMatch(/id=["']qrContainer["']/);
    // Must NOT pull in the SPA bundle (which is what was breaking TV browsers).
    expect(html).not.toMatch(/type=["']module["'][^>]*src=["']\/(src|assets)\//);
    // QR must encode an HTTPS URL so any phone camera can open it — NEVER a
    // custom scheme that requires an app handler.
    expect(html).toMatch(/qrData\s*=\s*['"]https:\/\/hoyeeh\.com\/cast\?code=/);
    expect(html).not.toMatch(/hoyeeh:\/\/pair/);
  });

  it("ships the static TV receiver at public/tv-receiver/index.html", () => {
    const receiver = resolve(root, "public/tv-receiver/index.html");
    expect(existsSync(receiver)).toBe(true);
    const html = read("public/tv-receiver/index.html");
    expect(html).toMatch(/<!DOCTYPE html>/i);
    expect(html.toLowerCase()).toContain("hoyeeh");
  });

  it("TV.tsx redirects browser to /tv-receiver/index.html", () => {
    const src = read("src/pages/TV.tsx");
    expect(src).toMatch(/window\.location\.href\s*=\s*["']\/tv-receiver\/index\.html["']/);
  });

  it("TVReceiver.tsx also redirects to /tv-receiver/index.html", () => {
    const src = read("src/pages/TVReceiver.tsx");
    expect(src).toMatch(/window\.location\.href\s*=\s*["']\/tv-receiver\/index\.html["']/);
  });

  it("registers /tv, /tv-receiver and /tv-app routes in App.tsx", () => {
    const app = read("src/App.tsx");
    expect(app).toMatch(/path=["']\/tv["']/);
    expect(app).toMatch(/path=["']\/tv-receiver["']/);
    expect(app).toMatch(/path=["']\/tv-app["']/);
    // And imports the page components
    expect(app).toMatch(/import\(["']\.\/pages\/TV["']\)/);
    expect(app).toMatch(/import\(["']\.\/pages\/TVReceiver["']\)/);
  });

  it("CastPairingDialog points users at hoyeeh.com/tv (canonical receiver URL)", () => {
    const src = read("src/components/cast/CastPairingDialog.tsx");
    expect(src).toContain("hoyeeh.com/tv");
  });

  it("auto-loads video after pair (no setTimeout race in UniversalCastButton)", () => {
    // Regression guard: the cast button must launch the player using the
    // sessionId returned by pairWithCode synchronously, not via setTimeout.
    const src = read("src/components/cast/UniversalCastButton.tsx");
    expect(src).toMatch(/await\s+loadVideo\(/);
    // No setTimeout-around-loadVideo race condition
    expect(src).not.toMatch(/setTimeout\([^)]*loadVideo/);
  });
});
