import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SafeAiReportText } from "../client/src/components/SafeAiReportText";

describe("SafeAiReportText", () => {
  it("escapes malicious AI HTML instead of creating executable elements", () => {
    const markup = renderToStaticMarkup(React.createElement(SafeAiReportText, {
      content: '<img src=x onerror="alert(1)"><script>alert(2)</script>',
    }));
    expect(markup).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(markup).toContain("&lt;script&gt;alert(2)&lt;/script&gt;");
    expect(markup).not.toContain("<script>");
    expect(markup).not.toContain("<img");
  });
});
