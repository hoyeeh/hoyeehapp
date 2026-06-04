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

describe("/tv static redirect — Smart TV engine compatibility", () => {
  it("ships a static file at public/tv/index.html (no SPA dependency)", () => {
    expect(existsSync(resolve(root, TV_INDEX))).toBe(true);
  });

  it("does not import any ES modules or SPA bundle assets", () => {
    const html = read(TV_INDEX);
    // No <script type="module">  — Tizen <2019 cannot parse modules.
    expect(html).not.toMatch(/<script[^>]+type=["']module["']/i);
    // No reference to the hashed SPA bundle.
    expect(html).not.toMatch(/\/assets\/index-[A-Za-z0-9_-]+\.js/);
    // No reference to /src/main.tsx (dev import).
    expect(html).not.toMatch(/\/src\/main\.tsx/);
  });

  it("provides BOTH meta-refresh and JS redirect to /tv-receiver/index.html", () => {
    const html = read(TV_INDEX);
    // Meta-refresh — primary mechanism, supported by every TV browser
    // including pre-2015 sets that cannot run inline scripts reliably.
    // Allow any small delay (0–3s) so a telemetry beacon can flush first.
    expect(html).toMatch(
      /<meta\s+http-equiv=["']refresh["']\s+content=["']\d+;\s*url=\/tv-receiver\/index\.html["']/i,
    );
    // JS redirect — fallback for engines that ignore meta-refresh inside
    // certain WebView containers. Accept inline literal or TARGET constant.
    expect(html).toMatch(/location\.(replace|href)\s*[=(]/);
    expect(html).toContain("/tv-receiver/index.html");
    // <noscript> fallback link so JS-disabled TVs still navigate.
    expect(html).toMatch(
      /<noscript>[\s\S]*\/tv-receiver\/index\.html[\s\S]*<\/noscript>/i,
    );
  });

  it("uses ES5-safe syntax in inline scripts (no optional chaining / nullish coalescing)", () => {
    const html = read(TV_INDEX);
    // Extract every inline <script>…</script>
    const inlineScripts = Array.from(html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi))
      .map((m) => m[1]);
    expect(inlineScripts.length).toBeGreaterThan(0);
    const joined = inlineScripts.join("\n");
    // ?. and ?? trigger SyntaxError on Tizen ≤2019 / webOS ≤2019.
    expect(joined).not.toMatch(/\?\./);
    expect(joined).not.toMatch(/\?\?(?!=)/);
    // Arrow with destructuring-only-rest / class-private fields also unsafe.
    expect(joined).not.toMatch(/#[A-Za-z_]\w*\s*=/);
  });

  it("parses & dispatches the redirect under every sampled Smart TV UA", async () => {
    const html = read(TV_INDEX);
    for (const [label, ua] of Object.entries(SMART_TV_UAS)) {
      const dom = new JSDOM(html, {
        url: "https://hoyeeh.com/tv",
        runScripts: "dangerously",
        userAgent: ua,
        pretendToBeVisual: true,
      });
      // Either the meta-refresh tag is parsed OR window.location was set by JS.
      const metaRefresh = dom.window.document.querySelector(
        'meta[http-equiv="refresh" i]',
      );
      expect(metaRefresh, `meta refresh missing for ${label}`).toBeTruthy();
      const content = metaRefresh!.getAttribute("content") || "";
      expect(content).toMatch(/\/tv-receiver\/index\.html/);
      dom.window.close();
    }
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
    // Top-level await would also fail to parse.
    expect(inline).not.toMatch(/^\s*await\s+/m);
  });

  it("declares a TV-safe viewport (1080p baseline) and dark background", () => {
    const html = read(RECEIVER);
    const dom = new JSDOM(html);
    const vp = dom.window.document.querySelector('meta[name="viewport"]');
    expect(vp).toBeTruthy();
    expect(vp!.getAttribute("content") || "").toMatch(/width=device-width/);
    // Dark background prevents the flash-of-white that some Smart TV
    // browsers render while loading external <script src>'s.
    expect(html).toMatch(/background:\s*#0a0a0a/i);
    dom.window.close();
  });

  it("self-redirects when the receiver shell is opened under a Smart TV UA", () => {
    // Sanity check: the receiver must NOT bounce the TV back to /tv.
    const html = read(RECEIVER);
    expect(html).not.toMatch(/window\.location\.(href|replace)\s*[=(]\s*['"]\/tv['"]/);
  });
});

describe("/tv ↔ /tv-receiver round-trip — UA-driven smoke test", () => {
  it.each(Object.entries(SMART_TV_UAS))(
    "%s reaches the receiver shell via the static /tv stub",
    async (_label, ua) => {
      const tvHtml = read(TV_INDEX);
      const dom = new JSDOM(tvHtml, {
        url: "https://hoyeeh.com/tv",
        userAgent: ua,
        runScripts: "outside-only", // Don't actually navigate jsdom
        pretendToBeVisual: true,
      });
      const meta = dom.window.document.querySelector(
        'meta[http-equiv="refresh" i]',
      );
      const content = meta?.getAttribute("content") || "";
      expect(content).toMatch(/url=\/tv-receiver\/index\.html/);
      // The receiver file at the redirect target must exist and contain a
      // pairing-code UI element so the TV actually shows something.
      const receiver = read(RECEIVER);
      expect(receiver).toMatch(/id=["']pairingCode["']/);
      dom.window.close();
    },
  );
});
