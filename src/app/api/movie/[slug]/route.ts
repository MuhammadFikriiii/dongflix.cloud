import { NextResponse } from "next/server";

import { loadMovieDetail } from "@/lib/worker-client";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    return NextResponse.json(await loadMovieDetail(slug));
  } catch {
    return NextResponse.json({ error: "movie_detail_unavailable" }, { status: 502 });
  }
}
