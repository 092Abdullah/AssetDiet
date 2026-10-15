import { describe, it, expect } from "vitest";
import { getAssetType, EXTENSION_TO_TYPE } from "../asset-types.js";

describe("getAssetType", () => {
  it("returns image for .jpg", () =>
    expect(getAssetType(".jpg")).toBe("image"));
  it("returns image for .PNG (case-insensitive)", () =>
    expect(getAssetType(".PNG")).toBe("image"));
  it("returns svg for .svg", () => expect(getAssetType(".svg")).toBe("svg"));
  it("returns video for .mp4", () =>
    expect(getAssetType(".mp4")).toBe("video"));
  it("returns 3d for .glb", () => expect(getAssetType(".glb")).toBe("3d"));
  it("returns font for .woff2", () =>
    expect(getAssetType(".woff2")).toBe("font"));
  it("returns unknown for .xyz", () =>
    expect(getAssetType(".xyz")).toBe("unknown"));
  it("covers all extensions in EXTENSION_TO_TYPE", () => {
    for (const [ext, type] of Object.entries(EXTENSION_TO_TYPE)) {
      expect(getAssetType(ext)).toBe(type);
    }
  });
});
