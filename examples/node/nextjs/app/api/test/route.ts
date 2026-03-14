import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") || "unknown";
  const error = request.nextUrl.searchParams.get("error");

  console.log(`[api/test] GET ${request.url}`);

  if (error) {
    return NextResponse.json({ error: "Test error", id }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id, timestamp: Date.now() });
}
