import { DonghuaEpisodeScreen } from "@/features/donghua/donghua-episode-screen";

export default async function MovieEpisodePage({ params }: { params: Promise<{ slug: string; episodeSlug: string }> }) {
  const { slug, episodeSlug } = await params;
  return <DonghuaEpisodeScreen showSlug={slug} episodeSlug={episodeSlug} kind="movie" />;
}
