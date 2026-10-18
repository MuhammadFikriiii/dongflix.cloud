import { NextResponse } from "next/server";

import { loadResolvedAnimeSources } from "@/lib/worker-client";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  if (!slug || slug.length > 240) return NextResponse.json({ error: "invalid_slug" }, { status: 400 });
  try {
    return NextResponse.json({ sources: await loadResolvedAnimeSources(slug) });
  } catch {
    return NextResponse.json({ sources: [] });
  }
}
