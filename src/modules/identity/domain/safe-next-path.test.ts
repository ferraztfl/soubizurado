import { describe, expect, it } from "vitest";

import { safeNextPath } from "./safe-next-path";

describe("safeNextPath", () => {
  it("keeps internal paths", () => {
    expect(safeNextPath("/assinatura")).toBe("/assinatura");
    expect(safeNextPath("/loja/combo-pmpe?x=1")).toBe("/loja/combo-pmpe?x=1");
  });

  it("rejects other hosts and junk", () => {
    expect(safeNextPath("//evil.com")).toBeNull();
    expect(safeNextPath("/\\evil.com")).toBeNull();
    expect(safeNextPath("https://evil.com")).toBeNull();
    expect(safeNextPath("javascript:alert(1)")).toBeNull();
    expect(safeNextPath("/a b")).toBeNull();
    expect(safeNextPath(null)).toBeNull();
  });
});
