import { getAuthSession, getAuthUser } from "@/lib/auth-helper";
import { NextResponse } from "next/server";
import { resolveClientName } from "@/lib/server-config";

export async function GET(request: Request) {
  const { userId } = await getAuthSession();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { searchParams } = new URL(request.url);
  const resolvedClient = resolveClientName(searchParams.get("client_name"));

  if (!resolvedClient.ok) {
    return NextResponse.json({ error: resolvedClient.error }, { status: resolvedClient.status });
  }
  const clientName = resolvedClient.clientName;

  try {
    const modalBaseUrl = process.env.MODAL_TRACKING_URL;
    const apiKey = process.env.ADSPULSE_INTERNAL_API_KEY;

    if (!modalBaseUrl || !apiKey) {
      return NextResponse.json({ error: "Modal tracking API is not configured" }, { status: 500 });
    }

    const modalUrl = `${modalBaseUrl}?client_name=${encodeURIComponent(clientName)}`;

    const response = await fetch(modalUrl, {
      headers: { "x-api-key": apiKey },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to fetch tracking data" }));
      return NextResponse.json(error, { status: response.status });
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Tracking Data Error:", error);
    return NextResponse.json({ error: "Failed to load tracking data" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { userId, orgRole } = await getAuthSession();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const body = await request.json();
    const resolvedClient = resolveClientName(body.client_name);
    if (!resolvedClient.ok) {
      return NextResponse.json({ error: resolvedClient.error }, { status: resolvedClient.status });
    }

    const modalUrl = process.env.MODAL_APPLY_URL;
    const apiKey = process.env.ADSPULSE_INTERNAL_API_KEY;

    if (!modalUrl || !apiKey) {
      return NextResponse.json({ error: "Modal apply API is not configured" }, { status: 500 });
    }

    // Resolve verified operator identity from session
    const clerkUser = await getAuthUser();
    const userRole = (clerkUser as any)?.publicMetadata?.role;
    if (userRole === "viewer" || orgRole === "org:viewer") {
      return NextResponse.json(
        { error: "Read-only access: Operator or Admin permissions are required to execute ad network mutations." },
        { status: 403 }
      );
    }

    const operatorName = clerkUser
      ? (clerkUser.fullName || [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || clerkUser.primaryEmailAddress?.emailAddress || userId)
      : "Authenticated Operator";
    const operatorEmail = clerkUser?.primaryEmailAddress?.emailAddress || "";
    const operatorAvatar = clerkUser?.imageUrl || "";

    const payload = {
      ...body,
      client_name: resolvedClient.clientName,
      applied_by: {
        user_id: userId,
        name: operatorName,
        email: operatorEmail,
        avatar: operatorAvatar,
      },
      applied_by_user_id: userId,
      applied_by_name: operatorName,
      applied_by_email: operatorEmail,
      applied_by_avatar: operatorAvatar,
    };

    const response = await fetch(modalUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-api-key": apiKey 
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    return NextResponse.json(result, { status: response.status });
  } catch (error) {
    console.error("Apply Recommendation Error:", error);
    return NextResponse.json({ error: "Failed to apply recommendation" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { userId, orgRole } = await getAuthSession();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const clerkUser = await getAuthUser();
  const userRole = (clerkUser as any)?.publicMetadata?.role;
  if (userRole === "viewer" || orgRole === "org:viewer") {
    return NextResponse.json(
      { error: "Read-only access: Operator or Admin permissions are required to dismiss tracking records." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const recommendationId = searchParams.get("recommendation_id");
  const resolvedClient = resolveClientName(searchParams.get("client_name"));

  if (!recommendationId) return new NextResponse("Missing recommendation_id", { status: 400 });
  if (!resolvedClient.ok) {
    return NextResponse.json({ error: resolvedClient.error }, { status: resolvedClient.status });
  }
  const clientName = resolvedClient.clientName;

  try {
    const modalBaseUrl = process.env.MODAL_TRACKING_DELETE_URL;
    const apiKey = process.env.ADSPULSE_INTERNAL_API_KEY;

    if (!modalBaseUrl || !apiKey) {
      return NextResponse.json({ error: "Modal tracking delete API is not configured" }, { status: 500 });
    }

    const modalUrl = `${modalBaseUrl}?recommendation_id=${encodeURIComponent(recommendationId)}&client_name=${encodeURIComponent(clientName)}`;

    const response = await fetch(modalUrl, {
      method: "DELETE",
      headers: { "x-api-key": apiKey },
    });

    const result = await response.json();
    return NextResponse.json(result, { status: response.status });
  } catch (error) {
    console.error("Delete Tracking Error:", error);
    return NextResponse.json({ error: "Failed to delete tracking item" }, { status: 500 });
  }
}
