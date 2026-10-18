"use client";

import { useState } from "react";
import Link from "next/link";

import type { CatalogItem } from "@/lib/catalog";

export function episodeLabel(raw: string, movie: boolean) {
  if (movie) return "Movie";
  const match = raw.match(/(?:episode|ep)\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (match) return `Episode ${match[1]}`;
  return raw.trim() || "Episode";
}

export function PosterCard({
  item,
  movie = false,
  href,
}: {
  item: CatalogItem;
  movie?: boolean;
  href?: string;
}) {
  const [failed, setFailed] = useState(false);

  const content = (
    <>
      <span className="poster-art">
        {failed ? (
          <span className="poster-fallback" aria-hidden="true">DF</span>
        ) : (
          // Provider posters come from several changing CDN hostnames. Native
          // lazy loading avoids downloading covers before they approach view.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.poster}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
          />
        )}
        <span className="poster-scrim" />
        <span className="poster-badge">{episodeLabel(item.episode, movie)}</span>
      </span>
      <span className="poster-title">{item.title}</span>
    </>
  );

  if (href) {
    return <Link className="poster-card" href={href} aria-label={`Buka ${item.title}`}>{content}</Link>;
  }

  return <button className="poster-card" type="button" aria-label={`Buka ${item.title}`}>{content}</button>;
}
