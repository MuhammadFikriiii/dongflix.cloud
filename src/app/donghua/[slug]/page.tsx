import { DonghuaDetailScreen } from "@/features/donghua/donghua-detail-screen";

export default async function DonghuaDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <DonghuaDetailScreen slug={slug} />;
}
