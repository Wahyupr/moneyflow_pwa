import { describe, expect, it } from "vitest";
import { stitchTheme } from "../stitch-theme";

describe("Stitch design theme", () => {
  it("keeps the Modern Urban Finance palette roles aligned with DESIGN.md", () => {
    expect(stitchTheme.colors.background).toBe("#f8f9ff");
    expect(stitchTheme.colors.primary).toBe("#006948");
    expect(stitchTheme.colors.secondary).toBe("#5654a8");
    expect(stitchTheme.colors.privacyMask).toBe("#E2E8F0");
  });

  it("uses Plus Jakarta Sans as the single product UI family", () => {
    expect(stitchTheme.typography.sans).toContain("Plus Jakarta Sans");
  });
});
