import { createHash } from "node:crypto";
import { getAuthSession } from "@/lib/auth-helper";
import { NextResponse } from "next/server";
import { normalizeN8nChatResponse, parseChatRequest } from "@/lib/chat-contract";
import { CHAT_UPSTREAM_TIMEOUT_MS } from "@/lib/chat-timeout";
import { resolveClientName } from "@/lib/server-config";

export const maxDuration = 120;
export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 8_192;
const UNAVAILABLE = "The assistant is unavailable right now. Please try again.";

function getCopilotEndpoint() {
  const rawUrl = process.env.N8N_MASTER_AGENT_URL?.trim();
  const secret = process.env.N8N_WEBHOOK_SECRET?.trim();
  if (!rawUrl || !secret) return null;

  try {
    const url = new URL(rawUrl);
    const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && isLocal)) return null;
    return { url: url.toString(), secret };
  } catch {
    return null;
  }
}

function opaqueSessionId(clientName: string, userId: string) {
  return createHash("sha256").update(`${clientName}:${userId}`).digest("hex");
}

export async function POST(request: Request) {
  const { userId } = await getAuthSession();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const endpoint = getCopilotEndpoint();
  if (!endpoint) {
    return NextResponse.json({ error: "The assistant is not configured." }, { status: 503 });
  }

  const resolvedClient = resolveClientName();
  if (!resolvedClient.ok) {
    return NextResponse.json({ error: resolvedClient.error }, { status: resolvedClient.status });
  }

  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    }

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    let input;
    try {
      input = parseChatRequest(parsedBody);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid request." },
        { status: 400 },
      );
    }

    const sessionId = opaqueSessionId(resolvedClient.clientName, userId);
    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": endpoint.secret,
      },
      body: JSON.stringify({
        message: input.message,
        response_style: input.responseStyle,
        client_name: resolvedClient.clientName,
        session_id: sessionId,
        user_id: sessionId,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(CHAT_UPSTREAM_TIMEOUT_MS),
    });

    if (!response.ok) {
      return NextResponse.json({ error: UNAVAILABLE }, { status: 502 });
    }

    const upstream = await response.json().catch(() => null);
    const result = normalizeN8nChatResponse(upstream);
    return NextResponse.json(
      {
        reply: result.reply,
        session_id: sessionId,
        ...(result.recommendationId ? { recommendation_id: result.recommendationId } : {}),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    console.error("Chat request failed", { errorType: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ error: UNAVAILABLE }, { status: timedOut ? 504 : 502 });
  }
}
