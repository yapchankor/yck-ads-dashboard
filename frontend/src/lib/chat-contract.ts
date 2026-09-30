export const RESPONSE_STYLES = ["direct", "balanced", "conversational"] as const;

export type ResponseStyle = (typeof RESPONSE_STYLES)[number];

export const DEFAULT_RESPONSE_STYLE: ResponseStyle = "balanced";

export type ChatRequest = {
  message: string;
  responseStyle: ResponseStyle;
};

export type ChatResponse = {
  reply: string;
  recommendationId: string | null;
};

const MAX_MESSAGE_LENGTH = 4_000;
const MAX_REPLY_LENGTH = 20_000;
const RECOMMENDATION_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$/;

type RecommendationIdentifier = {
  id?: unknown;
  recommendation_id?: unknown;
};

export function isResponseStyle(value: unknown): value is ResponseStyle {
  return typeof value === "string" && RESPONSE_STYLES.some((style) => style === value);
}

export function parseChatRequest(value: unknown): ChatRequest {
  if (!value || typeof value !== "object") throw new Error("Message is required");
  const record = value as { message?: unknown; response_style?: unknown };
  const message = typeof record.message === "string"
    ? record.message.trim()
    : "";

  if (!message) throw new Error("Message is required");
  if (message.length > MAX_MESSAGE_LENGTH) throw new Error("Message is too long");

  const responseStyle = record.response_style ?? DEFAULT_RESPONSE_STYLE;
  if (!isResponseStyle(responseStyle)) throw new Error("Response style is invalid");

  return { message, responseStyle };
}

export function normalizeN8nChatResponse(value: unknown): ChatResponse {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || typeof candidate !== "object") {
    throw new Error("Assistant response was invalid");
  }

  const record = candidate as Record<string, unknown>;
  const reply = typeof record.reply === "string" ? record.reply.trim() : "";
  if (!reply || reply.length > MAX_REPLY_LENGTH) {
    throw new Error("Assistant response was invalid");
  }

  const rawRecommendationId = record.recommendation_id ?? record.recommendationId;
  const recommendationId = typeof rawRecommendationId === "string"
    && RECOMMENDATION_ID.test(rawRecommendationId.trim())
    ? rawRecommendationId.trim()
    : null;

  return { reply, recommendationId };
}

export function findRecommendationById<T extends RecommendationIdentifier>(
  recommendations: T[],
  recommendationId: string,
): T | null {
  const id = recommendationId.trim();
  if (!RECOMMENDATION_ID.test(id)) return null;

  return recommendations.find((recommendation) => (
    recommendation.id === id || recommendation.recommendation_id === id
  )) ?? null;
}
