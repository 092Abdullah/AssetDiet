import { describe, it, expect } from "vitest";
import { parseConfig, defaultConfig } from "../config.js";

describe("parseConfig", () => {
  it("returns defaults for empty object", () => {
    const cfg = parseConfig({});
    expect(cfg.policy).toBe("safe");
    expect(cfg.images.quality).toBe(85);
    expect(cfg.limits.concurrency).toBe(4);
    expect(cfg.fonts.subsetting).toBe(false);
  });

  it("accepts valid overrides", () => {
    const cfg = parseConfig({ policy: "aggressive", images: { quality: 70 } });
    expect(cfg.policy).toBe("aggressive");
    expect(cfg.images.quality).toBe(70);
  });

  it("throws on invalid policy", () => {
    expect(() => parseConfig({ policy: "nuclear" })).toThrow();
  });

  it("throws on quality out of range", () => {
    expect(() => parseConfig({ images: { quality: 200 } })).toThrow();
  });
});

describe("defaultConfig", () => {
  it("has safe policy", () => {
    expect(defaultConfig().policy).toBe("safe");
  });
  it("excludes node_modules", () => {
    expect(defaultConfig().exclude).toContain("node_modules");
  });
});
