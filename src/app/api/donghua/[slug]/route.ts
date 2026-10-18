import { NextResponse } from "next/server";

import { loadDonghuaDetail } from "@/lib/worker-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  if (!slug || slug.length > 240) {
    return NextResponse.json({ error: "invalid_slug" }, { status: 400 });
  }

  try {
    const detail = await loadDonghuaDetail(slug);
    if (!detail.title) {
      return NextResponse.json({ error: "detail_not_found" }, { status: 404 });
    }
    return NextResponse.json(detail, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "detail_unavailable" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
