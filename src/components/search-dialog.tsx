"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { LoaderCircle, Search, X } from "lucide-react";

import { PosterCard } from "@/components/poster-card";
import type { CatalogItem } from "@/lib/catalog";
import { webApiUrl } from "@/lib/web-api";

type SearchItem = CatalogItem & { category: "donghua" | "anime" | "movie" };
type SearchPayload = { items?: SearchItem[]; unavailable?: string[] };

export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  if (!open) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const keyword = query.trim();
    if (keyword.length < 2 || loading) return;
    setLoading(true);
    setError(false);
    setSearched(true);
    try {
      const response = await fetch(webApiUrl(`/api/search?q=${encodeURIComponent(keyword)}`), { cache: "no-store" });
      if (!response.ok) throw new Error("search_unavailable");
      const payload = await response.json() as SearchPayload;
      setItems(Array.isArray(payload.items) ? payload.items : []);
    } catch {
      setItems([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="search-overlay" role="dialog" aria-modal="true" aria-label="Pencarian DongFlix">
      <header className="search-header">
        <form className="search-form" onSubmit={(event) => void submit(event)}>
          <Search aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari donghua, anime, atau film..."
            aria-label="Kata pencarian"
          />
          {query ? <button type="button" aria-label="Hapus pencarian" onClick={() => { setQuery(""); setItems([]); setSearched(false); }}><X /></button> : null}
        </form>
        <button className="search-close" type="button" onClick={onClose} aria-label="Tutup pencarian">Tutup</button>
      </header>

      <section className="search-body" aria-live="polite">
        {!searched ? <div className="search-empty"><Search /><h2>Cari tontonan favoritmu</h2><p>Hasil mencakup donghua, anime, dan film seperti di aplikasi DongFlix.</p></div> : null}
        {loading ? <div className="search-status"><LoaderCircle className="search-spinner" /><span>Mencari...</span></div> : null}
        {!loading && error ? <div className="search-empty"><h2>Pencarian belum bisa dimuat</h2><p>Periksa koneksi lalu coba kembali.</p></div> : null}
        {!loading && !error && searched && items.length === 0 ? <div className="search-empty"><h2>Hasil tidak ditemukan</h2><p>Coba gunakan judul atau kata kunci lain.</p></div> : null}
        {!loading && items.length > 0 ? (
          <div className="search-results">
            {items.map((item, index) => {
              const slug = item.animeSlug || item.slug;
              const base = item.category === "movie" ? "/movie" : item.category === "anime" ? "/anime" : "/donghua";
              return <PosterCard key={`${item.category}-${slug}-${index}`} item={item} movie={item.category === "movie"} href={`${base}/${encodeURIComponent(slug)}`} />;
            })}
          </div>
        ) : null}
      </section>
    </div>
  );
}
