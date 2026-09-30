import { describe, expect, it } from "vitest";
import {
  findRecommendationById,
  normalizeN8nChatResponse,
  parseChatRequest,
} from "./chat-contract";

describe("parseChatRequest", () => {
  it("accepts and trims a normal chat message", () => {
    expect(parseChatRequest({ message: "  What should I improve?  " })).toEqual({
      message: "What should I improve?",
      responseStyle: "balanced",
    });
  });

  it("accepts each supported response style", () => {
    expect(parseChatRequest({ message: "Be brief", response_style: "direct" })).toEqual({
      message: "Be brief",
      responseStyle: "direct",
    });
    expect(parseChatRequest({ message: "Explain it", response_style: "conversational" })).toEqual({
      message: "Explain it",
      responseStyle: "conversational",
    });
  });

  it("rejects unsupported response styles", () => {
    expect(() => parseChatRequest({ message: "Hello", response_style: "unlimited" })).toThrow(
      "Response style is invalid",
    );
  });

  it("rejects missing, blank, and oversized messages", () => {
    expect(() => parseChatRequest({})).toThrow("Message is required");
    expect(() => parseChatRequest({ message: "   " })).toThrow("Message is required");
    expect(() => parseChatRequest({ message: "x".repeat(4_001) })).toThrow("Message is too long");
  });
});

describe("normalizeN8nChatResponse", () => {
  it("preserves the existing reply contract and accepts an optional recommendation id", () => {
    expect(normalizeN8nChatResponse({
      reply: "Review the placement recommendation.",
      recommendation_id: "meta_placement_123",
    })).toEqual({
      reply: "Review the placement recommendation.",
      recommendationId: "meta_placement_123",
    });
  });

  it("supports n8n responses wrapped in a one-item array", () => {
    expect(normalizeN8nChatResponse([{ reply: "Campaign performance is stable." }])).toEqual({
      reply: "Campaign performance is stable.",
      recommendationId: null,
    });
  });

  it("drops malformed recommendation ids instead of trusting model output", () => {
    expect(normalizeN8nChatResponse({
      reply: "I found a recommendation.",
      recommendation_id: "../../another-tenant",
    })).toEqual({
      reply: "I found a recommendation.",
      recommendationId: null,
    });
  });

  it("rejects an upstream response without a usable reply", () => {
    expect(() => normalizeN8nChatResponse({ recommendation_id: "rec-1" })).toThrow(
      "Assistant response was invalid",
    );
  });
});

describe("findRecommendationById", () => {
  const recommendations = [
    { id: "current-id", recommendation_id: "legacy-current-id" },
    { id: "another-id", recommendation_id: "legacy-id" },
  ];

  it("finds a current recommendation by its dashboard id", () => {
    expect(findRecommendationById(recommendations, "current-id")).toBe(recommendations[0]);
  });

  it("supports the existing recommendation_id field", () => {
    expect(findRecommendationById(recommendations, "legacy-id")).toBe(recommendations[1]);
  });

  it("returns null for invalid or stale ids", () => {
    expect(findRecommendationById(recommendations, "../../other-tenant")).toBeNull();
    expect(findRecommendationById(recommendations, "missing-id")).toBeNull();
  });
});
