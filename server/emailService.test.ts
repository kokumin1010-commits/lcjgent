import { describe, expect, it } from "vitest";
import { escapeHtml } from "./emailService";

describe("task email HTML escaping", () => {
  it("escapes tags, attributes, quotes and ampersands", () => {
    expect(escapeHtml('<a href="javascript:alert(1)">A&B</a>')).toBe(
      "&lt;a href=&quot;javascript:alert(1)&quot;&gt;A&amp;B&lt;/a&gt;"
    );
  });
});
