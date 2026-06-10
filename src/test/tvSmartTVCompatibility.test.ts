/**
 * Smart TV engine compatibility E2E tests for /tv deep linking.
 *
 * Verifies that hoyeeh.com/tv works on the three Smart TV browser families
 * that historically broke when /tv routed through the React SPA bundle:
 *
 *   1. Samsung Tizen (Chromium 47–76 depending on model year)
 *   2. LG webOS (legacy WebKit on pre-2018 sets, Chromium 53+ on newer)
 *   3. Generic "legacy WebKit" — Vewd / Opera TV / older Hisense / Sony
 *
 * The audit catches three classes of regression:
 *   A. /tv re-imports the SPA bundle (which fails to parse on legacy engines)
 *   B. /tv redirect mechanism gets weakened (loses meta-refresh or JS fallback)
 *   C. The receiver shell drops a legacy polyfill or starts using
 *      modern-only syntax (optional chaining, nullish coalescing, fetch w/o
 *      polyfill, ES modules) that older Smart TV engines cannot parse.
 *
 * These are pure static-analysis tests against the shipped HTML so they run
 * fast in CI without spinning up a headless browser farm.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";

const root = resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf8");

const TV_INDEX = "public/tv/index.html";
const RECEIVER = "public/tv-receiver/index.html";

/** Sample Smart TV user-agents observed in production logs. */
const SMART_TV_UAS = {
  tizen2018:
    "Mozilla/5.0 (SMART-TV; LINUX; Tizen 4.0) AppleWebKit/538.1 (KHTML, like Gecko) Version/4.0 NativeTVAds Safari/538.1",
  tizen2021:
    "Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) 76.0.3809.146/6.0 TV Safari/537.36",
  webos2017:
    "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/38.0.2125.122 Safari/537.36 WebAppManager",
  webos2022:
    "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36 WebAppManager",
  legacyWebKit:
    "Mozilla/5.0 (Linux; U; en-US) AppleWebKit/533.3 (KHTML, like Gecko) Vewd/3.5 Safari/533.3",
} as const;

describe("/tv direct receiver — Smart TV engine compatibility", () => {
  it("ships a static file at public/tv/index.html (no SPA dependency)", () => {
    expect(existsSync(resolve(root, TV_INDEX))).toBe(true);
  });

  it("does not import any ES modules or SPA bundle assets", () => {
    const html = read(TV_INDEX);
    expect(html).not.toMatch(/<script[^>]+type=["']module["']/i);
    expect(html).not.toMatch(/\/assets\/index-[A-Za-z0-9_-]+\.js/);
    expect(html).not.toMatch(/\/src\/main\.tsx/);
  });

  it("serves the full receiver inline (no redirect to /tv-receiver)", () => {
    // The old /tv stub used meta-refresh + JS to redirect TVs to
    // /tv-receiver/index.html. Many Smart TV browsers blocked or ignored
    // the redirect, leaving users on a blank page. /tv now serves the
    // receiver directly so no navigation is required.
    const html = read(TV_INDEX);
    expect(html).toMatch(/id=["']pairingScreen["']/);
    expect(html).toMatch(/id=["']pairingCode["']/);
    expect(html).toMatch(/id=["']qrContainer["']/);
    // Must NOT auto-redirect away from /tv.
    expect(html).not.toMatch(/<meta\s+http-equiv=["']refresh["']/i);
    expect(html).not.toMatch(/window\.location\.(href|replace)\s*[=(]\s*['"]\/tv-receiver/);
  });

  it("uses ES5-safe syntax in inline scripts (no optional chaining / nullish coalescing)", () => {
    const html = read(TV_INDEX);
    const inlineScripts = Array.from(html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi))
      .map((m) => m[1]);
    expect(inlineScripts.length).toBeGreaterThan(0);
    const joined = inlineScripts.join("\n");
    expect(joined).not.toMatch(/\?\./);
    expect(joined).not.toMatch(/\?\?(?!=)/);
    expect(joined).not.toMatch(/#[A-Za-z_]\w*\s*=/);
  });

  it("encodes an HTTPS QR URL (not a custom scheme) so any phone camera can pair", () => {
    const html = read(TV_INDEX);
    expect(html).toMatch(/https:\/\/hoyeeh\.com\/cast\?code=/);
    expect(html).not.toMatch(/hoyeeh:\/\/pair/);
  });

  it("renders an HOYEEH brand placeholder while the TV navigates", () => {
    const html = read(TV_INDEX);
    const dom = new JSDOM(html);
    const body = dom.window.document.body.textContent || "";
    expect(body.toLowerCase()).toContain("hoyeeh");
    dom.window.close();
  });
});

describe("/tv-receiver shell — Smart TV engine compatibility", () => {
  it("loads UMD polyfills before any inline application code", () => {
    const html = read(RECEIVER);
    // Order check: es6-promise + whatwg-fetch must appear before the first
    // inline <script> that contains application logic, otherwise legacy
    // Tizen / webOS sets throw ReferenceError on `Promise`/`fetch`.
    const promiseIdx = html.indexOf("es6-promise");
    const fetchIdx = html.indexOf("whatwg-fetch");
    const inlineAppIdx = html.search(/<script(?![^>]*\bsrc=)[^>]*>\s*(?:\/\/[^\n]*\n\s*)?\(function/);
    expect(promiseIdx).toBeGreaterThan(0);
    expect(fetchIdx).toBeGreaterThan(0);
    expect(inlineAppIdx).toBeGreaterThan(0);
    expect(promiseIdx).toBeLessThan(inlineAppIdx);
    expect(fetchIdx).toBeLessThan(inlineAppIdx);
  });

  it("loads UMD builds of supabase-js, hls.js and qrcodejs (no ESM)", () => {
    const html = read(RECEIVER);
    expect(html).toMatch(/@supabase\/supabase-js@2\/dist\/umd\/supabase\.min\.js/);
    expect(html).toMatch(/hls\.js@[\d.]+\/dist\/hls\.min\.js/);
    expect(html).toMatch(/qrcodejs@[\d.]+\/qrcode\.min\.js/);
    // No `import` / `export` statements anywhere — pure ES5 script tags.
    expect(html).not.toMatch(/<script[^>]+type=["']module["']/i);
    const inlineScripts = Array.from(html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi))
      .map((m) => m[1])
      .join("\n");
    expect(inlineScripts).not.toMatch(/^\s*import\s+/m);
    expect(inlineScripts).not.toMatch(/^\s*export\s+/m);
  });

  it("guards against missing Promise/fetch with a user-facing fallback", () => {
    const html = read(RECEIVER);
    // checkBrowserCompat() guards Promise + fetch and shows #browserError.
    expect(html).toMatch(/typeof\s+Promise\s*===\s*['"]undefined['"]/);
    expect(html).toMatch(/typeof\s+fetch\s*===\s*['"]undefined['"]/);
    expect(html).toMatch(/id=["']browserError["']/);
  });

  it("uses ES5-only syntax in the receiver inline script", () => {
    const html = read(RECEIVER);
    const inline = Array.from(html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi))
      .map((m) => m[1])
      .join("\n");
    // Hard-blockers for Tizen 2017 / webOS 3 / legacy WebKit:
    expect(inline, "optional chaining is unsupported on legacy Smart TVs").not.toMatch(/\?\./);
    expect(inline, "nullish coalescing is unsupported on legacy Smart TVs").not.toMatch(/\?\?(?!=)/);
    expect(inline).not.toMatch(/^\s*await\s+/m);
  });
});

describe("/tv ↔ /tv-receiver parity — both paths must work", () => {
  it("both /tv and /tv-receiver expose the pairing UI directly", () => {
    const tv = read(TV_INDEX);
    const recv = read(RECEIVER);
    for (const html of [tv, recv]) {
      expect(html).toMatch(/id=["']pairingScreen["']/);
      expect(html).toMatch(/id=["']pairingCode["']/);
      expect(html).toMatch(/id=["']qrContainer["']/);
    }
  });

  it.each(Object.entries(SMART_TV_UAS))(
    "%s renders the pairing UI under the smart TV UA without a redirect",
    async (_label, ua) => {
      const tvHtml = read(TV_INDEX);
      const dom = new JSDOM(tvHtml, {
        url: "https://hoyeeh.com/tv",
        userAgent: ua,
        runScripts: "outside-only",
        pretendToBeVisual: true,
      });
      expect(dom.window.document.querySelector("#pairingCode")).toBeTruthy();
      expect(dom.window.document.querySelector("#qrContainer")).toBeTruthy();
      expect(dom.window.document.querySelector('meta[http-equiv="refresh" i]')).toBeNull();
      dom.window.close();
    },
  );
});
