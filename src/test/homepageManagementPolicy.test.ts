import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("Homepage management policy", () => {
  it("keeps the manual editor scoped to manual rows", () => {
    const source = readFileSync("src/components/admin/EnhancedHomeSectionManagement.tsx", "utf8");
    expect(source).toContain('.eq("source", "manual")');
    expect(source).toContain('source: "manual"');
  });

  it("limits automatic actions to content refresh and healing", () => {
    const source = readFileSync("src/components/admin/HomepageAIAutopilot.tsx", "utf8");
    expect(source).toContain('{ id: "content_swap"');
    expect(source).toContain('{ id: "heal"');
    expect(source).not.toContain('{ id: "new_section"');
    expect(source).not.toContain('{ id: "reorder"');
  });

  it("rejects automated structural changes in the server applier", () => {
    const source = readFileSync("supabase/functions/_shared/homepageSuggestions.ts", "utf8");
    expect(source).toContain('Automated structural changes are disabled');
    expect(source).toContain('section.source !== "manual"');
  });
});