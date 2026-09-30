import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AssistantMarkdown } from "@/components/ui/AssistantMarkdown";

function render(content: string) {
  return renderToStaticMarkup(createElement(AssistantMarkdown, { content }));
}

describe("AssistantMarkdown", () => {
  it("renders common assistant formatting as semantic HTML", () => {
    const html = render([
      "## Top performers",
      "",
      "* **Meta campaign:** 1,050 conversions",
      "* [Open report](https://example.com/report)",
      "",
      "| Platform | CPA |",
      "| --- | ---: |",
      "| Meta | RM 0.97 |",
    ].join("\n"));

    expect(html).toContain("<strong class=\"font-semibold\">Meta campaign:</strong>");
    expect(html).toContain("<ul");
    expect(html).toContain("<table");
    expect(html).toContain("href=\"https://example.com/report\"");
  });

  it("does not turn raw HTML or unsafe links into executable markup", () => {
    const html = render(
      "<img src=x onerror=alert(1)> [unsafe](javascript:alert(1)) [external](//evil.example)",
    );

    expect(html).not.toContain("<img");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("evil.example");
    expect(html).not.toContain("href=");
    expect(html).toContain("unsafe");
  });
});
