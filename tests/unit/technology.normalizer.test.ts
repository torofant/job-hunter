import { describe, expect, it } from "vitest";
import { normalizeTechnology } from "../../src/modules/jobs/technology.normalizer.js";

describe("normalizeTechnology", () => {
  it("normalizes aliases", () => {
    expect(normalizeTechnology("JS")).toBe("javascript");
    expect(normalizeTechnology("JavaScript")).toBe("javascript");
    expect(normalizeTechnology("TS")).toBe("typescript");
    expect(normalizeTechnology("node.js")).toBe("nodejs");
    expect(normalizeTechnology("React.js")).toBe("react");
    expect(normalizeTechnology("React Native")).toBe("react-native");
  });

  it("normalizes unknown technologies without inventing aliases", () => {
    expect(normalizeTechnology("  PostgreSQL  ")).toBe("postgresql");
    expect(normalizeTechnology("Java")).toBe("java");
    expect(normalizeTechnology("JavaScript")).not.toBe("java");
    expect(normalizeTechnology("React")).not.toBe("react-native");
  });
});