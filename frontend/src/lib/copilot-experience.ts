import {
  DEFAULT_RESPONSE_STYLE,
  isResponseStyle,
  type ResponseStyle,
} from "./chat-contract";

const OVERVIEW_STARTERS = [
  "What needs my attention today?",
  "Compare Google Ads and Meta.",
  "Explain my top recommendation.",
] as const;

const GOOGLE_STARTERS = [
  "Which Google campaign needs attention?",
  "Where is Google spend being wasted?",
  "Explain my top Google recommendation.",
] as const;

const META_STARTERS = [
  "Which Meta campaign needs attention?",
  "Which Meta ads are performing best?",
  "Explain my top Meta recommendation.",
] as const;

const RECOMMENDATION_STARTERS = [
  "Explain my top recommendation.",
  "Which change would have the biggest impact?",
  "What should I review first?",
] as const;

export function getConversationStarters(pathname: string): readonly string[] {
  if (pathname.startsWith("/google")) return GOOGLE_STARTERS;
  if (pathname.startsWith("/meta")) return META_STARTERS;
  if (pathname.startsWith("/recommendations")) return RECOMMENDATION_STARTERS;
  return OVERVIEW_STARTERS;
}

export function normalizeStoredResponseStyle(value: string | null): ResponseStyle {
  return isResponseStyle(value) ? value : DEFAULT_RESPONSE_STYLE;
}

export function getCopilotStyleStorageKey(clientName: string): string {
  return `adspulse-copilot-response-style:${clientName}`;
}
