import { NextResponse } from "next/server";

import { loadMovieEpisode } from "@/lib/worker-client";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const { episode } = await loadMovieEpisode(slug);
    return NextResponse.json(episode);
  } catch {
    return NextResponse.json({ error: "movie_episode_unavailable" }, { status: 502 });
  }
}
