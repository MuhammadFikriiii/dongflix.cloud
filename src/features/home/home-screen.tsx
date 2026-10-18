"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Bookmark,
  History,
  Home,
  Search,
  UserRound,
} from "lucide-react";

import { cleanCatalogSlug, type CatalogItem, type HomeCatalog } from "@/lib/catalog";
import { ComingSoonDialog } from "@/components/coming-soon-dialog";
import { PosterCard } from "@/components/poster-card";
import { SearchDialog } from "@/components/search-dialog";
import { webApiUrl } from "@/lib/web-api";

const EMPTY_HOME: HomeCatalog = { donghua: [], anime: [], films: [], unavailable: [] };

const NAVIGATION = [
  { label: "Beranda", icon: Home, active: true },
  { label: "Novel", icon: BookOpen, active: false },
  { label: "Bookmark", icon: Bookmark, active: false },
  { label: "Riwayat", icon: History, active: false },
  { label: "Profil", icon: UserRound, active: false },
] as const;

async function fetchHome() {
  const response = await fetch(webApiUrl("/api/home"), { cache: "no-store" });
  const data = (await response.json()) as HomeCatalog;
  return { response, data };
}

function ContentRow({
  title,
  items,
  category,
  movie = false,
}: {
  title: string;
  items: CatalogItem[];
  category: "donghua" | "anime" | "film";
  movie?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <section className="content-section" aria-labelledby={`${title}-heading`}>
      <div className="section-header">
        <h2 id={`${title}-heading`}>{title}</h2>
        <Link href={`/lihat-semua/${category}`} aria-label={`Lihat semua ${title}`}>
          Lihat Semua
        </Link>
      </div>
      <div className="poster-row">
        {items.map((item, index) => (
          <PosterCard
            key={`${item.animeSlug || item.slug}-${index}`}
            item={item}
            movie={movie}
            href={category === "donghua"
              ? `/donghua/${encodeURIComponent(cleanCatalogSlug(item.animeSlug))}`
              : category === "anime"
                ? `/anime/${encodeURIComponent(cleanCatalogSlug(item.animeSlug || item.slug))}`
                : `/movie/${encodeURIComponent(cleanCatalogSlug(item.animeSlug || item.slug))}`}
          />
        ))}
      </div>
    </section>
  );
}

function SkeletonRows() {
  return (
    <div className="skeleton-rows" aria-label="Memuat katalog">
      {[0, 1, 2].map((row) => (
        <section className="content-section" key={row}>
          <div className="skeleton-title" />
          <div className="poster-row" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5, 6].map((card) => (
              <div className="skeleton-card" key={card}>
                <div className="skeleton-poster" />
                <div className="skeleton-line" />
                <div className="skeleton-line short" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function HomeScreen() {
  const [catalog, setCatalog] = useState<HomeCatalog>(EMPTY_HOME);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pendingFeature, setPendingFeature] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const { response, data } = await fetchHome();
      setCatalog(data);
      if (!response.ok && data.donghua.length + data.anime.length + data.films.length === 0) {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    void fetchHome()
      .then(({ response, data }) => {
        if (!active) return;
        setCatalog(data);
        if (!response.ok && data.donghua.length + data.anime.length + data.films.length === 0) {
          setError(true);
        }
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
  }, []);

  const hasContent = catalog.donghua.length + catalog.anime.length + catalog.films.length > 0;

  return (
    <main className="app-shell">
      <header className="top-bar">
        <h1>DongFlix</h1>
        <button className="icon-button" type="button" aria-label="Cari tontonan" onClick={() => setSearchOpen(true)}>
          <Search aria-hidden="true" />
        </button>
      </header>

      <div className="home-content" aria-live="polite">
        {loading && !hasContent ? <SkeletonRows /> : null}

        {!loading && error && !hasContent ? (
          <section className="error-state">
            <span className="error-mark">DF</span>
            <h2>Katalog belum bisa dimuat</h2>
            <p>Periksa koneksi atau konfigurasi Worker, lalu coba lagi.</p>
            <button type="button" onClick={() => void load()}>Coba lagi</button>
          </section>
        ) : null}

        {hasContent ? (
          <>
            {catalog.unavailable.length > 0 ? (
              <div className="partial-notice">Sebagian katalog sedang tidak tersedia.</div>
            ) : null}
            <ContentRow title="Donghua Terbaru" items={catalog.donghua} category="donghua" />
            <ContentRow title="Anime Terbaru" items={catalog.anime} category="anime" />
            <ContentRow title="Film Terbaru" items={catalog.films} category="film" movie />
          </>
        ) : null}
      </div>

      <nav className="floating-dock" aria-label="Navigasi utama">
        {NAVIGATION.map(({ label, icon: Icon, active }) => (
          <button
            className={active ? "dock-item active" : "dock-item"}
            type="button"
            aria-current={active ? "page" : undefined}
            aria-label={label}
            onClick={() => {
              if (!active) setPendingFeature(label);
            }}
            key={label}
          >
            <Icon aria-hidden="true" fill={active ? "currentColor" : "none"} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <ComingSoonDialog feature={pendingFeature} onClose={() => setPendingFeature(null)} />
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </main>
  );
}
