import { describe, expect, it } from "vitest";
import { normalizeSafeHttpUrl, safeHttpUrlOrNull } from "../shared/safeHttpUrl";

describe("safe evidence URLs", () => {
  it("accepts and normalizes only HTTP and HTTPS links", () => {
    expect(normalizeSafeHttpUrl("https://example.com/a b")).toBe("https://example.com/a%20b");
    expect(normalizeSafeHttpUrl("http://example.com/path")).toBe("http://example.com/path");
  });

  it.each(["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "ftp://example.com/a", "https://u:p@example.com/"])(
    "rejects unsafe evidence URL %s",
    value => {
      expect(() => normalizeSafeHttpUrl(value)).toThrow();
      expect(safeHttpUrlOrNull(value)).toBeNull();
    }
  );
});
