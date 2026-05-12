import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const modalUrl = process.env.MODAL_REFRESH_STATUS_URL || process.env.MODAL_API_BASE_URL;
  const apiKey = process.env.ADSPULSE_INTERNAL_API_KEY;
  if (!modalUrl || !apiKey) {
    return NextResponse.json({ error: "Modal refresh status API is not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("job_id");
  const url = jobId ? `${modalUrl}?job_id=${encodeURIComponent(jobId)}` : modalUrl;

  const response = await fetch(url, {
    headers: { "x-api-key": apiKey },
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));
  return NextResponse.json(result, { status: response.status });
}
