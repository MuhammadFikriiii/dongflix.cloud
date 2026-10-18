import { NextResponse } from "next/server";

import { loadResolvedMovieSources } from "@/lib/worker-client";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    return NextResponse.json({ sources: await loadResolvedMovieSources(slug) });
  } catch {
    return NextResponse.json({ sources: [] }, { status: 502 });
  }
}
