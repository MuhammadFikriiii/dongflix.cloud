import { DonghuaEpisodeScreen } from "@/features/donghua/donghua-episode-screen";

export default async function AnimeEpisodePage({
  params,
}: {
  params: Promise<{ slug: string; episodeSlug: string }>;
}) {
  const { slug, episodeSlug } = await params;
  return <DonghuaEpisodeScreen key={episodeSlug} showSlug={slug} episodeSlug={episodeSlug} kind="anime" />;
}
