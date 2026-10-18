import { NextResponse } from "next/server";

import { loadDonghuaEpisode } from "@/lib/worker-client";

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
    const episode = await loadDonghuaEpisode(slug);
    if (!episode.title && episode.sources.length === 0) {
      return NextResponse.json({ error: "episode_not_found" }, { status: 404 });
    }
    return NextResponse.json(episode);
  } catch (error) {
    console.error("Donghua episode request failed", error);
    return NextResponse.json({ error: "episode_unavailable" }, { status: 503 });
  }
}
