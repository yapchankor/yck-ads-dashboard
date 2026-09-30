import { describe, expect, it } from "vitest";
import {
  getConversationStarters,
  getCopilotStyleStorageKey,
  normalizeStoredResponseStyle,
} from "./copilot-experience";

describe("getConversationStarters", () => {
  it("returns cross-platform prompts on the overview", () => {
    expect(getConversationStarters("/")).toEqual([
      "What needs my attention today?",
      "Compare Google Ads and Meta.",
      "Explain my top recommendation.",
    ]);
  });

  it("returns platform-specific prompts on Google and Meta pages", () => {
    expect(getConversationStarters("/google")[0]).toBe("Which Google campaign needs attention?");
    expect(getConversationStarters("/meta")[0]).toBe("Which Meta campaign needs attention?");
  });

  it("returns recommendation-focused prompts on the recommendations page", () => {
    expect(getConversationStarters("/recommendations")).toContain(
      "Which change would have the biggest impact?",
    );
  });
});

describe("copilot response style preference", () => {
  it("accepts supported stored values and safely defaults to balanced", () => {
    expect(normalizeStoredResponseStyle("direct")).toBe("direct");
    expect(normalizeStoredResponseStyle("conversational")).toBe("conversational");
    expect(normalizeStoredResponseStyle("unknown")).toBe("balanced");
    expect(normalizeStoredResponseStyle(null)).toBe("balanced");
  });

  it("scopes browser preferences to the active dashboard client", () => {
    expect(getCopilotStyleStorageKey("GENERA")).toBe("adspulse-copilot-response-style:GENERA");
    expect(getCopilotStyleStorageKey("YAP CHAN KOR")).toBe(
      "adspulse-copilot-response-style:YAP CHAN KOR",
    );
  });
});
