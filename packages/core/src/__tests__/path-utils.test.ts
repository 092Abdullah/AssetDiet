import { describe, it, expect } from "vitest";
import {
  safeResolve,
  isWithinRoot,
  normalizePath,
  getExtension,
} from "../path-utils.js";
import path from "node:path";

describe("safeResolve", () => {
  const root = "/workspace";

  it("resolves a safe relative path", () => {
    const result = safeResolve(root, "assets/logo.png");
    expect(result).toBe(path.resolve(root, "assets/logo.png"));
  });

  it("throws on path traversal with ../", () => {
    expect(() => safeResolve(root, "../../etc/passwd")).toThrow(
      "Path traversal",
    );
  });

  it("throws on absolute path outside root", () => {
    expect(() => safeResolve(root, "/etc/passwd")).toThrow("Path traversal");
  });

  it("allows root itself", () => {
    const result = safeResolve(root, ".");
    expect(result).toBe(path.resolve(root));
  });
});

describe("isWithinRoot", () => {
  const root = "/workspace";
  it("returns true for a path within root", () =>
    expect(isWithinRoot(root, "/workspace/assets/img.png")).toBe(true));
  it("returns false for a path outside root", () =>
    expect(isWithinRoot(root, "/etc/passwd")).toBe(false));
  it("returns true for the root itself", () =>
    expect(isWithinRoot(root, root)).toBe(true));
});

describe("normalizePath", () => {
  it("converts backslashes to forward slashes", () => {
    expect(normalizePath("foo\\bar\\baz")).toBe("foo/bar/baz");
  });
  it("leaves forward slashes unchanged", () => {
    expect(normalizePath("foo/bar/baz")).toBe("foo/bar/baz");
  });
});

describe("getExtension", () => {
  it("returns lowercase extension with dot", () => {
    expect(getExtension("image.PNG")).toBe(".png");
    expect(getExtension("video.MP4")).toBe(".mp4");
    expect(getExtension("noext")).toBe("");
  });
});
