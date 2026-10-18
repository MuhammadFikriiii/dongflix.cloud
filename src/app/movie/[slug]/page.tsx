import { DonghuaDetailScreen } from "@/features/donghua/donghua-detail-screen";

export default async function MovieDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <DonghuaDetailScreen slug={slug} kind="movie" />;
}
