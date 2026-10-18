"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bookmark,
  BookmarkPlus,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Download,
  Info,
  Play,
  Search,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { ComingSoonDialog } from "@/components/coming-soon-dialog";
import type { DonghuaDetail } from "@/lib/catalog";
import { webApiUrl } from "@/lib/web-api";

function formatEpisodeTitle(title: string, searchQuery: string) {
  const clean = title.trim();
  if (!clean || searchQuery.trim()) return clean || title;
  return clean.match(/episode\s+\d+/i)?.[0] ?? clean;
}

function DetailSkeleton() {
  return (
    <main className="detail-page" aria-label="Memuat detail Donghua">
      <div className="detail-hero detail-hero-skeleton" />
      <div className="detail-body">
        <div className="detail-skeleton-line wide" />
        <div className="detail-skeleton-line" />
        <div className="detail-skeleton-line" />
        <div className="episode-skeleton-list">
          {Array.from({ length: 8 }, (_, index) => <div key={index} />)}
        </div>
      </div>
    </main>
  );
}

export function DonghuaDetailScreen({ slug, kind = "donghua" }: { slug: string; kind?: "donghua" | "anime" | "movie" }) {
  const router = useRouter();
  const apiBase = kind === "anime" ? "/api/anime" : kind === "movie" ? "/api/movie" : "/api/donghua";
  const routeBase = kind === "anime" ? "/anime" : kind === "movie" ? "/movie" : "/donghua";
  const contentLabel = kind === "anime" ? "Anime" : kind === "movie" ? "Film" : "Donghua";
  const [detail, setDetail] = useState<DonghuaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [showSynopsis, setShowSynopsis] = useState(false);
  const [pendingFeature, setPendingFeature] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch(webApiUrl(`${apiBase}/${encodeURIComponent(slug)}`), { cache: "no-store" });
      if (!response.ok) throw new Error("detail_unavailable");
      setDetail((await response.json()) as DonghuaDetail);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [apiBase, slug]);

  useEffect(() => {
    let active = true;
    void fetch(webApiUrl(`${apiBase}/${encodeURIComponent(slug)}`), { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("detail_unavailable");
        return response.json() as Promise<DonghuaDetail>;
      })
      .then((data) => {
        if (active) setDetail(data);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    queueMicrotask(() => {
      if (!active) return;
      try {
        setBookmarked(window.localStorage.getItem(`dongflix:bookmark:${kind}:${slug}`) === "1");
      } catch {
        // Private browser modes can deny storage; the screen still works.
      }
    });

    return () => {
      active = false;
    };
  }, [apiBase, kind, slug]);

  const filteredEpisodes = useMemo(() => {
    if (!detail) return [];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return detail.episodes;
    return detail.episodes.filter(
      (episode) =>
        episode.title.toLowerCase().includes(normalized) ||
        episode.slug.toLowerCase().includes(normalized),
    );
  }, [detail, query]);

  const visibleEpisodes = showAll || query.trim()
    ? filteredEpisodes
    : filteredEpisodes.slice(0, 20);

  const toggleBookmark = () => {
    const next = !bookmarked;
    setBookmarked(next);
    try {
      if (next) window.localStorage.setItem(`dongflix:bookmark:${kind}:${slug}`, "1");
      else window.localStorage.removeItem(`dongflix:bookmark:${kind}:${slug}`);
    } catch {
      // Keep the in-memory state even if storage is unavailable.
    }
  };

  if (loading && !detail) return <DetailSkeleton />;

  if (error && !detail) {
    return (
      <main className="detail-page">
        <header className="detail-error-bar">
          <button type="button" onClick={() => router.replace("/")} aria-label="Kembali ke beranda"><ChevronLeft /></button>
        </header>
        <section className="error-state detail-error">
          <span className="error-mark">DF</span>
          <h2>Detail belum bisa dimuat</h2>
          <p>Periksa koneksi, lalu coba lagi.</p>
          <button type="button" onClick={() => void fetchDetail()}>Coba lagi</button>
        </section>
      </main>
    );
  }

  if (!detail) return null;

  return (
    <main className="detail-page">
      <section className="detail-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="detail-backdrop" src={detail.poster} alt="" referrerPolicy="no-referrer" />
        <div className="detail-hero-scrim" />
        <button className="detail-back" type="button" onClick={() => router.replace("/")} aria-label="Kembali ke beranda">
          <ChevronLeft aria-hidden="true" />
        </button>
        <div className="detail-identity">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="detail-poster" src={detail.poster} alt={`Poster ${detail.title}`} referrerPolicy="no-referrer" />
          <div className="detail-summary">
            <h1>{detail.title}</h1>
            <div className={detail.info.status.toLowerCase() === "ongoing" ? "detail-fact ongoing" : "detail-fact"}>
              <Info /><span>{detail.info.status || contentLabel}</span>
            </div>
            <div className="detail-fact"><Clapperboard /><span>{kind === "movie" ? "Movie" : `${detail.episodes.length} Episode`}</span></div>
            <div className="detail-fact"><Building2 /><span>{detail.info.studio || "China"}</span></div>
          </div>
        </div>
      </section>

      <div className="detail-body">
        <button className={bookmarked ? "bookmark-button active" : "bookmark-button"} type="button" onClick={toggleBookmark}>
          {bookmarked ? <Bookmark fill="currentColor" /> : <BookmarkPlus />}
          <span>{bookmarked ? "Tersimpan" : "Bookmark"}</span>
        </button>

        {detail.genres.length > 0 ? (
          <div className="genre-list">
            {detail.genres.map((genre) => <span key={genre}>{genre}</span>)}
          </div>
        ) : null}

        {detail.synopsis ? (
          <button className="synopsis-preview" type="button" onClick={() => setShowSynopsis(true)}>
            {detail.synopsis}
          </button>
        ) : null}

        <section className="episode-section">
          <div className="episode-heading">
            <span className="heading-accent" />
            <h2>{kind === "movie" ? "Tonton Film" : "Daftar Episode"}</h2>
            <span>{kind === "movie" ? "Full Movie" : `${filteredEpisodes.length} eps`}</span>
            <button
              type="button"
              aria-label={showSearch ? "Tutup pencarian episode" : "Cari episode"}
              onClick={() => {
                setShowSearch((current) => !current);
                if (showSearch) setQuery("");
              }}
            >
              {showSearch ? <X className="active" /> : <Search />}
            </button>
          </div>

          {showSearch ? (
            <label className="episode-search">
              <Search aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari episode..."
                autoFocus
              />
              {query ? (
                <button type="button" onClick={() => setQuery("")} aria-label="Bersihkan pencarian"><X /></button>
              ) : null}
            </label>
          ) : null}

          <div className="episode-list">
            {visibleEpisodes.map((episode) => (
              <Link className="episode-row" href={`${routeBase}/${encodeURIComponent(slug)}/episode/${encodeURIComponent(episode.slug)}`} key={episode.slug}>
                <span className="episode-play"><Play fill="currentColor" /></span>
                <span className="episode-copy">
                  <strong>{formatEpisodeTitle(episode.title, query)}</strong>
                  <small>{episode.date}</small>
                </span>
                <span
                  className="episode-download"
                  aria-label="Unduh episode"
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setPendingFeature("Unduhan episode");
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    event.stopPropagation();
                    setPendingFeature("Unduhan episode");
                  }}
                ><Download /></span>
                <ChevronRight className="episode-chevron" aria-hidden="true" />
              </Link>
            ))}
          </div>

          {!showAll && !query.trim() && filteredEpisodes.length > 20 ? (
            <button className="show-all-episodes" type="button" onClick={() => setShowAll(true)}>
              <ChevronDown />
              <span>Tampilkan Semua {filteredEpisodes.length} Episode</span>
            </button>
          ) : null}

          {query.trim() && filteredEpisodes.length === 0 ? (
            <div className="episode-empty">Episode tidak ditemukan.</div>
          ) : null}
        </section>
      </div>

      {showSynopsis ? (
        <div className="synopsis-modal" role="dialog" aria-modal="true" aria-labelledby="synopsis-title" onClick={() => setShowSynopsis(false)}>
          <div className="synopsis-dialog" onClick={(event) => event.stopPropagation()}>
            <h2 id="synopsis-title">{detail.title}</h2>
            <p>{detail.synopsis}</p>
            <button type="button" onClick={() => setShowSynopsis(false)}>Tutup</button>
          </div>
        </div>
      ) : null}

      <ComingSoonDialog feature={pendingFeature} onClose={() => setPendingFeature(null)} />
    </main>
  );
}
