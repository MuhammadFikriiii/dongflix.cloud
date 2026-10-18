import { NextRequest, NextResponse } from "next/server";

import type { CatalogCategory } from "@/lib/catalog";
import { loadCatalogPage } from "@/lib/worker-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATEGORIES = new Set<CatalogCategory>(["donghua", "anime", "film"]);

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ category: string }> },
) {
  const { category: rawCategory } = await context.params;
  if (!CATEGORIES.has(rawCategory as CatalogCategory)) {
    return NextResponse.json({ error: "category_not_found" }, { status: 404 });
  }

  const requestedPage = Number(request.nextUrl.searchParams.get("page") ?? "1");
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.trunc(requestedPage)) : 1;

  try {
    const items = await loadCatalogPage(rawCategory as CatalogCategory, page);
    return NextResponse.json(
      { items, page, hasMore: items.length > 0 },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { items: [], page, hasMore: true, error: "catalog_unavailable" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
