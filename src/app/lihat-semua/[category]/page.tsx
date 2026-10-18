import { notFound } from "next/navigation";

import { SeeAllScreen } from "@/features/catalog/see-all-screen";
import type { CatalogCategory } from "@/lib/catalog";

const TITLES: Record<CatalogCategory, string> = {
  donghua: "Donghua Terbaru",
  anime: "Anime Terbaru",
  film: "Film Terbaru",
};

export default async function SeeAllPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: rawCategory } = await params;
  if (!(rawCategory in TITLES)) notFound();

  const category = rawCategory as CatalogCategory;
  return <SeeAllScreen category={category} title={TITLES[category]} />;
}
