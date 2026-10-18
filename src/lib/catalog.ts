export type CatalogItem = {
  title: string;
  slug: string;
  animeSlug: string;
  poster: string;
  episode: string;
  type: string;
};

export type HomeCatalog = {
  donghua: CatalogItem[];
  anime: CatalogItem[];
  films: CatalogItem[];
  unavailable: string[];
};

export type CatalogCategory = "donghua" | "anime" | "film";

export type DonghuaEpisode = {
  title: string;
  slug: string;
  date: string;
};

export type DonghuaDetail = {
  title: string;
  poster: string;
  synopsis: string;
  genres: string[];
  episodes: DonghuaEpisode[];
  info: {
    status: string;
    studio: string;
    released: string;
    duration: string;
    country: string;
    type: string;
  };
};

export type DonghuaStreamSource = {
  name: string;
  url: string;
};

export type DongflixResolvedSource = {
  url: string;
  directUrl?: string;
  proxyUrl: string;
  quality: string;
  container: "mp4" | "hls";
};

export type DonghuaEpisodeDetail = {
  title: string;
  episodeTitle: string;
  sources: DonghuaStreamSource[];
  previousSlug: string;
  nextSlug: string;
};

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringValue = (value: unknown) => (typeof value === "string" ? value : "");

export function cleanCatalogSlug(slug: string) {
  return slug.replace(/^\/(?:anime|movie|series)\//, "").replace(/^\/+|\/+$/g, "");
}

export function parseItems(value: unknown): CatalogItem[] {
  if (!Array.isArray(value)) {
    if (!isRecord(value)) return [];
    const nested = value.data ?? value.items ?? value.results ?? value.latest_release
      ?? value.ongoing ?? value.ongoing_anime ?? value.ongoing_donghua
      ?? value.completed_donghua ?? value.popular_today;
    return nested === value ? [] : parseItems(nested);
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const title = stringValue(entry.title).trim();
    const poster = stringValue(entry.poster || entry.image || entry.thumbnail || entry.cover).trim();
    if (!title || !poster) return [];

    return [{
      title,
      slug: stringValue(entry.slug),
      animeSlug: stringValue(entry.anime_slug || entry.animeSlug || entry.series_slug || entry.id),
      poster,
      episode: stringValue(entry.ep || entry.episode || entry.episode_number),
      type: stringValue(entry.type || entry.category),
    }];
  });
}

export function recordValue(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

export function parseDonghuaDetail(value: unknown): DonghuaDetail {
  const raw = recordValue(value);
  const info = recordValue(raw.info);
  const rawEpisodes = Array.isArray(raw.episodes_list)
    ? raw.episodes_list
    : Array.isArray(raw.episode_list)
      ? raw.episode_list
      : [];
  const seen = new Set<string>();

  const episodes = rawEpisodes.flatMap((entry) => {
    const episode = recordValue(entry);
    const slug = stringValue(episode.slug).trim();
    if (!slug || seen.has(slug)) return [];
    seen.add(slug);
    return [{
      title: stringValue(episode.title),
      slug,
      date: stringValue(episode.date),
    }];
  });

  const rawGenres = Array.isArray(raw.genres)
    ? raw.genres
    : Array.isArray(raw.genre)
      ? raw.genre
      : [];

  return {
    title: stringValue(raw.title),
    poster: stringValue(raw.poster),
    synopsis: stringValue(raw.synopsis),
    genres: rawGenres.map(String),
    episodes,
    info: {
      status: stringValue(info.status),
      studio: stringValue(info.studio),
      released: stringValue(info.released),
      duration: stringValue(info.duration),
      country: stringValue(info.country),
      type: stringValue(info.type) || "Donghua",
    },
  };
}

export function parseAnimeDetail(value: unknown): DonghuaDetail {
  const raw = recordValue(value);
  const info = recordValue(raw.info);
  const rawEpisodes = Array.isArray(raw.episodes_list)
    ? raw.episodes_list
    : Array.isArray(raw.episodes)
      ? raw.episodes
      : [];
  const rawGenres = Array.isArray(raw.genres) ? raw.genres : [];
  const seen = new Set<string>();

  return {
    title: stringValue(raw.title),
    poster: stringValue(raw.poster),
    synopsis: stringValue(raw.synopsis),
    genres: rawGenres.flatMap((entry) => {
      if (typeof entry === "string") return entry;
      const genre = recordValue(entry);
      const name = stringValue(genre.name || genre.title).trim();
      return name ? [name] : [];
    }),
    episodes: rawEpisodes.flatMap((entry) => {
      const episode = recordValue(entry);
      const slug = stringValue(episode.slug).trim();
      if (!slug || seen.has(slug)) return [];
      seen.add(slug);
      return [{
        title: stringValue(episode.title || episode.episode),
        slug,
        date: stringValue(episode.date || episode.release_date),
      }];
    }),
    info: {
      status: stringValue(raw.status || info.status),
      studio: stringValue(raw.studio || info.studio),
      released: stringValue(raw.released || info.tanggal_rilis || info.released),
      duration: stringValue(raw.duration || info.durasi || info.duration),
      country: "Japan",
      type: stringValue(raw.type || info.tipe || info.type) || "Anime",
    },
  };
}

export function parseDonghuaEpisode(value: unknown): DonghuaEpisodeDetail {
  const raw = recordValue(value);
  const streaming = recordValue(raw.streaming);
  const navigation = recordValue(raw.navigation);
  const previous = recordValue(navigation.previous_episode);
  const next = recordValue(navigation.next_episode);
  const sourceValue = Array.isArray(streaming.servers)
    ? streaming.servers
    : Array.isArray(streaming.sources)
      ? streaming.sources
      : Array.isArray(raw.sources)
        ? raw.sources
        : Array.isArray(raw.servers)
          ? raw.servers
          : [];

  const sources = sourceValue.flatMap((entry, index) => {
    if (typeof entry === "string") {
      const url = entry.trim();
      return url ? [{ name: `Server ${index + 1}`, url }] : [];
    }
    const source = recordValue(entry);
    const url = stringValue(source.url || source.stream_url || source.iframe).trim();
    if (!url) return [];
    return [{
      name: stringValue(source.name || source.title || source.quality).trim() || `Server ${index + 1}`,
      url,
    }];
  });

  const fallbackUrl = stringValue(raw.iframe || raw.stream_url).trim();
  if (sources.length === 0 && fallbackUrl) {
    sources.push({ name: "Server 1", url: fallbackUrl });
  }

  return {
    title: stringValue(raw.title || raw.episode),
    episodeTitle: stringValue(raw.episode_title || raw.episode || raw.title),
    sources,
    previousSlug: stringValue(previous.slug || raw.prev_slug || raw.prev),
    nextSlug: stringValue(next.slug || raw.next_slug || raw.next),
  };
}
