import { NextResponse } from "next/server";

import { loadHomeCatalog } from "@/lib/worker-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const catalog = await loadHomeCatalog();
  const hasContent = catalog.donghua.length + catalog.anime.length + catalog.films.length > 0;

  return NextResponse.json(catalog, {
    status: hasContent ? 200 : 503,
    headers: { "Cache-Control": "private, no-store" },
  });
}
