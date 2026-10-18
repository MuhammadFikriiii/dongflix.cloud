"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";

import { PosterCard } from "@/components/poster-card";
import { cleanCatalogSlug, type CatalogCategory, type CatalogItem } from "@/lib/catalog";
import { webApiUrl } from "@/lib/web-api";

type CatalogPage = {
  items: CatalogItem[];
  page: number;
  hasMore: boolean;
  error?: string;
};

async function fetchCatalogPage(category: CatalogCategory, page: number) {
  const response = await fetch(webApiUrl(`/api/catalog/${category}?page=${page}`), { cache: "no-store" });
  const data = (await response.json()) as CatalogPage;
  if (!response.ok) throw new Error(data.error || "catalog_unavailable");
  return data;
}

function CatalogSkeleton() {
  return (
    <div className="catalog-grid" aria-label="Memuat katalog">
      {Array.from({ length: 15 }, (_, index) => (
        <div className="skeleton-card" key={index} aria-hidden="true">
          <div className="skeleton-poster" />
          <div className="skeleton-line" />
          <div className="skeleton-line short" />
        </div>
      ))}
    </div>
  );
}

export function SeeAllScreen({
  category,
  title,
}: {
  category: CatalogCategory;
  title: string;
}) {
  const router = useRouter();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(false);

  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await fetchCatalogPage(category, 1);
      setItems(data.items);
      setPage(1);
      setHasMore(data.hasMore && data.items.length > 0);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    let active = true;
    void fetchCatalogPage(category, 1)
      .then((data) => {
        if (!active) return;
        setItems(data.items);
        setPage(1);
        setHasMore(data.hasMore && data.items.length > 0);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [category]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore || error || page < 1) return;
    setLoadingMore(true);
    try {
      const data = await fetchCatalogPage(category, page + 1);
      setItems((current) => {
        const seen = new Set(current.map((item) => item.animeSlug || item.slug));
        const unique = data.items.filter((item) => !seen.has(item.animeSlug || item.slug));
        return [...current, ...unique];
      });
      setPage(data.page);
      setHasMore(data.hasMore && data.items.length > 0);
    } catch {
      setError(true);
    } finally {
      setLoadingMore(false);
    }
  }, [category, error, hasMore, loading, loadingMore, page]);

  const retryLoadMore = useCallback(() => {
    setError(false);
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void loadMore();
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <main className="catalog-page">
      <header className="catalog-bar">
        <button type="button" onClick={() => router.back()} aria-label="Kembali ke Beranda">
          <ChevronLeft aria-hidden="true" />
        </button>
        <h1>{title}</h1>
      </header>

      {loading ? <CatalogSkeleton /> : null}

      {!loading && error && items.length === 0 ? (
        <section className="error-state catalog-error">
          <span className="error-mark">DF</span>
          <h2>Katalog belum bisa dimuat</h2>
          <p>Periksa koneksi, lalu coba lagi.</p>
          <button type="button" onClick={() => void loadFirstPage()}>Coba lagi</button>
        </section>
      ) : null}

      {items.length > 0 ? (
        <div className="catalog-grid">
          {items.map((item, index) => (
            <PosterCard
              key={`${item.animeSlug || item.slug}-${index}`}
              item={item}
              movie={category === "film"}
              href={category === "donghua"
                ? `/donghua/${encodeURIComponent(cleanCatalogSlug(item.animeSlug))}`
                : category === "anime"
                  ? `/anime/${encodeURIComponent(cleanCatalogSlug(item.animeSlug || item.slug))}`
                  : `/movie/${encodeURIComponent(cleanCatalogSlug(item.animeSlug || item.slug))}`}
            />
          ))}
        </div>
      ) : null}

      <div className="catalog-load-state" ref={sentinelRef} aria-live="polite">
        {loadingMore ? <LoaderCircle className="load-spinner" aria-label="Memuat halaman berikutnya" /> : null}
        {!loading && !hasMore && items.length > 0 ? <span>Semua tayangan telah ditampilkan</span> : null}
        {!loading && error && items.length > 0 ? (
          <button type="button" onClick={retryLoadMore}>Coba muat lagi</button>
        ) : null}
      </div>
    </main>
  );
}
