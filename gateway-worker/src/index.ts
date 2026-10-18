type Env = {
  UPSTREAM_DONGHUA_KEY: string;
  UPSTREAM_ANIME_KEY: string;
  PUBLIC_API_LIMITER: RateLimit;
};

type JsonRecord = Record<string, unknown>;
type Kind = "donghua" | "anime" | "movie";

const DONGHUA_ORIGIN = "https://donghuawatch-worker.antigravityfikri.workers.dev";
const ANIME_ORIGIN = "https://donghuawatch-anime-api.fikri772277.workers.dev";
const ALLOWED_ORIGINS = new Set([
  "https://dongflix-web.vercel.app",
  "https://dongflix.cloud",
  "https://www.dongflix.cloud",
  "http://localhost:3000",
]);
const FRESH_MS = 5 * 60 * 1000;
const STALE_SECONDS = 60 * 60;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const record = (value: unknown): JsonRecord => isRecord(value) ? value : {};
const text = (value: unknown) => typeof value === "string" ? value : "";

function cors(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(value: unknown, status: number, origin: string, extra: HeadersInit = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors(origin), ...extra },
  });
}

function parseItems(value: unknown, depth = 0): JsonRecord[] {
  if (!Array.isArray(value)) {
    if (!isRecord(value) || depth >= 5) return [];
    const preferred = [value.data, value.items, value.results, value.latest_release,
      value.ongoing, value.ongoing_anime, value.ongoing_donghua,
      value.completed_donghua, value.popular_today];
    for (const nested of [...preferred, ...Object.values(value)]) {
      const parsed = parseItems(nested, depth + 1);
      if (parsed.length) return parsed;
    }
    return [];
  }
  return value.flatMap((entry) => {
    const item = record(entry);
    const title = text(item.title || item.name).trim();
    const poster = text(item.poster || item.image || item.thumbnail || item.cover || item.poster_url || item.image_url).trim();
    if (!title || !poster) return [];
    return [{
      title,
      slug: text(item.slug || item.episode_slug || item.url_slug),
      animeSlug: text(item.anime_slug || item.animeSlug || item.series_slug || item.detail_slug || item.id),
      poster,
      episode: text(item.ep || item.episode || item.episode_number),
      type: text(item.type || item.category),
    }];
  });
}

function parseDetail(value: unknown, kind: Kind) {
  const raw = record(record(value).data ?? value);
  const info = record(raw.info);
  const rawEpisodes = Array.isArray(raw.episodes_list) ? raw.episodes_list
    : Array.isArray(raw.episode_list) ? raw.episode_list
      : Array.isArray(raw.episodes) ? raw.episodes : [];
  const seen = new Set<string>();
  const episodes = rawEpisodes.flatMap((entry) => {
    const ep = record(entry);
    const slug = text(ep.slug).trim();
    if (!slug || seen.has(slug)) return [];
    seen.add(slug);
    return [{ title: text(ep.title || ep.episode), slug, date: text(ep.date || ep.release_date) }];
  });
  const rawGenres = Array.isArray(raw.genres) ? raw.genres : Array.isArray(raw.genre) ? raw.genre : [];
  return {
    title: text(raw.title), poster: text(raw.poster), synopsis: text(raw.synopsis),
    genres: rawGenres.flatMap((entry) => {
      if (typeof entry === "string") return [entry];
      const value = text(record(entry).name || record(entry).title).trim();
      return value ? [value] : [];
    }),
    episodes,
    info: {
      status: text(raw.status || info.status), studio: text(raw.studio || info.studio),
      released: text(raw.released || info.tanggal_rilis || info.released),
      duration: text(raw.duration || info.durasi || info.duration),
      country: kind === "donghua" ? text(info.country) : kind === "anime" ? "Japan" : "",
      type: text(raw.type || info.tipe || info.type) || (kind === "donghua" ? "Donghua" : kind === "anime" ? "Anime" : "Movie"),
    },
  };
}

function parseEpisode(value: unknown) {
  const raw = record(record(value).data ?? value);
  const streaming = record(raw.streaming);
  const navigation = record(raw.navigation);
  const previous = record(navigation.previous_episode);
  const next = record(navigation.next_episode);
  const rawSources = Array.isArray(streaming.servers) ? streaming.servers
    : Array.isArray(streaming.sources) ? streaming.sources
      : Array.isArray(raw.sources) ? raw.sources : Array.isArray(raw.servers) ? raw.servers : [];
  const sources = rawSources.flatMap((entry, index) => {
    if (typeof entry === "string") return entry ? [{ name: `Server ${index + 1}`, url: entry }] : [];
    const source = record(entry);
    const url = text(source.url || source.stream_url || source.iframe).trim();
    return url ? [{ name: text(source.name || source.title || source.quality) || `Server ${index + 1}`, url }] : [];
  });
  const fallback = text(raw.iframe || raw.stream_url).trim();
  if (!sources.length && fallback) sources.push({ name: "Server 1", url: fallback });
  return {
    title: text(raw.title || raw.episode), episodeTitle: text(raw.episode_title || raw.episode || raw.title),
    sources, previousSlug: text(previous.slug || raw.prev_slug || raw.prev),
    nextSlug: text(next.slug || raw.next_slug || raw.next),
  };
}

async function upstream(url: string, key: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "X-Dongflix-Key": key, Accept: "application/json" },
        signal: AbortSignal.timeout(7_000),
      });
      if (!response.ok) throw new Error(`upstream_${response.status}`);
      return await response.json() as unknown;
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw lastError;
}

async function loadRoute(path: string, search: URLSearchParams, env: Env) {
  if (path === "/api/home") {
    const calls = await Promise.allSettled([
      upstream(`${DONGHUA_ORIGIN}/api/home/1`, env.UPSTREAM_DONGHUA_KEY),
      upstream(`${ANIME_ORIGIN}/api/anime/ongoing/1`, env.UPSTREAM_ANIME_KEY),
      upstream(`${DONGHUA_ORIGIN}/api/lk21/home/1`, env.UPSTREAM_DONGHUA_KEY),
    ]);
    const values = calls.map((call) => call.status === "fulfilled" ? call.value : {});
    console.log("home_upstream_shapes", values.map((value, index) => ({
      source: ["donghua", "anime", "film"][index],
      status: calls[index].status,
      root: Array.isArray(value) ? "array" : typeof value,
      keys: isRecord(value) ? Object.keys(value).slice(0, 12) : [],
    })));
    const result = {
      donghua: parseItems(values[0]), anime: parseItems(values[1]), films: parseItems(values[2]),
      unavailable: ["donghua", "anime", "film"].filter((_, index) => calls[index].status === "rejected"),
    };
    if (!result.donghua.length && !result.anime.length && !result.films.length) throw new Error("empty_home");
    return result;
  }

  const catalog = path.match(/^\/api\/catalog\/(donghua|anime|film)$/);
  if (catalog) {
    const category = catalog[1];
    const page = Math.max(1, Math.min(500, Number.parseInt(search.get("page") ?? "1", 10) || 1));
    const url = category === "donghua" ? `${DONGHUA_ORIGIN}/api/home/${page}`
      : category === "anime" ? `${ANIME_ORIGIN}/api/anime/ongoing/${page}`
        : `${DONGHUA_ORIGIN}/api/lk21/home/${page}`;
    const items = parseItems(await upstream(url, category === "anime" ? env.UPSTREAM_ANIME_KEY : env.UPSTREAM_DONGHUA_KEY));
    return { items, page, hasMore: items.length > 0 };
  }

  const match = path.match(/^\/api\/(donghua|anime|movie)(\/episode)?\/([^/]+)$/);
  if (!match) throw new Error("not_found");
  const kind = match[1] as Kind;
  const episode = Boolean(match[2]);
  const slug = decodeURIComponent(match[3]);
  if (!slug || slug.length > 240) throw new Error("invalid_slug");
  let url: string;
  if (kind === "donghua") url = `${DONGHUA_ORIGIN}/api/${episode ? "episode" : "detail"}/${encodeURIComponent(slug)}`;
  else if (kind === "anime") url = `${ANIME_ORIGIN}/api/anime/${episode ? "episode" : "detail"}/${encodeURIComponent(slug)}`;
  else url = `${DONGHUA_ORIGIN}/api/lk21/${episode ? "episode" : "detail"}/${encodeURIComponent(slug)}?refresh=true`;
  const value = await upstream(url, kind === "anime" ? env.UPSTREAM_ANIME_KEY : env.UPSTREAM_DONGHUA_KEY);
  return episode ? parseEpisode(value) : parseDetail(value, kind);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const origin = request.headers.get("Origin") ?? "";
    if (!ALLOWED_ORIGINS.has(origin)) return new Response("Forbidden", { status: 403 });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, origin);

    const url = new URL(request.url);
    const rateKey = `${request.headers.get("CF-Connecting-IP") ?? "unknown"}:${url.pathname.split("/").slice(0, 4).join("/")}`;
    const allowed = await env.PUBLIC_API_LIMITER.limit({ key: rateKey });
    if (!allowed.success) return json({ error: "too_many_requests" }, 429, origin);

    const cache = caches.default;
    const cacheUrl = new URL(url);
    cacheUrl.searchParams.set("__gateway_cache", "v2");
    const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
    const cached = await cache.match(cacheKey);
    let stale: { value: unknown; savedAt: number } | null = null;
    if (cached) {
      stale = await cached.json() as { value: unknown; savedAt: number };
      if (Date.now() - stale.savedAt < FRESH_MS) return json(stale.value, 200, origin, { "X-Dongflix-Cache": "HIT" });
    }

    try {
      const value = await loadRoute(url.pathname, url.searchParams, env);
      const stored = new Response(JSON.stringify({ value, savedAt: Date.now() }), {
        headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${STALE_SECONDS}` },
      });
      ctx.waitUntil(cache.put(cacheKey, stored));
      return json(value, 200, origin, { "Cache-Control": "public, max-age=300", "X-Dongflix-Cache": "MISS" });
    } catch (error) {
      if (stale) return json(stale.value, 200, origin, { "X-Dongflix-Cache": "STALE" });
      const message = error instanceof Error && error.message === "not_found" ? "not_found" : "temporarily_unavailable";
      return json({ error: message }, message === "not_found" ? 404 : 503, origin);
    }
  },
} satisfies ExportedHandler<Env>;
