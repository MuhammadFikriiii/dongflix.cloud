import { DonghuaDetailScreen } from "@/features/donghua/donghua-detail-screen";

export default async function AnimeDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <DonghuaDetailScreen slug={slug} kind="anime" />;
}
