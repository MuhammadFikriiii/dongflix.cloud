import "server-only";

import { createHmac } from "node:crypto";
import { Resolver } from "node:dns";
import { request as httpsRequest } from "node:https";

import {
  CatalogCategory,
  DongflixResolvedSource,
  HomeCatalog,
  parseAnimeDetail,
  parseDonghuaDetail,
  parseDonghuaEpisode,
  parseItems,
  recordValue,
} from "@/lib/catalog";

const DONGHUA_ORIGIN = "https://donghuawatch-worker.antigravityfikri.workers.dev";
const ANIME_ORIGIN = "https://donghuawatch-anime-api.fikri772277.workers.dev";

type SourceName = "donghua" | "anime" | "film";

const publicResolver = new Resolver();
publicResolver.setServers(["1.1.1.1", "8.8.8.8"]);

const dnsCache = new Map<string, { addresses: string[]; expiresAt: number }>();

function resolvePublicIpv4(hostname: string): Promise<string[]> {
  const cached = dnsCache.get(hostname);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.addresses);

  return new Promise((resolve, reject) => {
    publicResolver.resolve4(hostname, { ttl: true }, (error, records) => {
      if (error) {
        reject(error);
        return;
      }

      const addresses = records.map((record) => record.address);
      if (addresses.length === 0) {
        reject(new Error("public_dns_empty"));
        return;
      }

      const shortestTtl = Math.min(...records.map((record) => record.ttl));
      dnsCache.set(hostname, {
        addresses,
        expiresAt: Date.now() + Math.max(30, shortestTtl) * 1_000,
      });
      resolve(addresses);
    });
  });
}

/**
 * Request an existing Worker while bypassing ISP DNS poisoning of workers.dev.
 * TLS still validates the original hostname because only the socket lookup is
 * overridden; the URL, Host header, and SNI remain unchanged.
 */
async function requestWorkerViaPublicDns(
  url: string,
  key: string,
  keyHeader = "X-Dongflix-Key",
  body?: Record<string, unknown>,
) {
  const target = new URL(url);
  const addresses = await resolvePublicIpv4(target.hostname);

  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const request = httpsRequest(
      target,
      {
        method: body ? "POST" : "GET",
        headers: {
          Accept: "application/json",
          [keyHeader]: key,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        lookup: (_hostname, options, callback) => {
          const address = addresses[Math.floor(Math.random() * addresses.length)];
          if (typeof options === "object" && options.all) {
            callback(null, [{ address, family: 4 }]);
            return;
          }
          callback(null, address, 4);
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        let byteLength = 0;

        response.on("data", (chunk: Buffer) => {
          byteLength += chunk.length;
          if (byteLength > 8 * 1024 * 1024) {
            request.destroy(new Error("worker_response_too_large"));
            return;
          }
          chunks.push(chunk);
        });

        response.on("end", () => {
          const status = response.statusCode ?? 500;
          if (status < 200 || status >= 300) {
            reject(new Error(`worker_${status}`));
            return;
          }

          try {
            resolve(recordValue(JSON.parse(Buffer.concat(chunks).toString("utf8"))));
          } catch {
            reject(new Error("worker_invalid_json"));
          }
        });
      },
    );

    request.setTimeout(20_000, () => request.destroy(new Error("worker_timeout")));
    request.on("error", reject);
    request.end(body ? JSON.stringify(body) : undefined);
  });
}

async function requestWorker(
  url: string,
  key: string | undefined,
  keyHeader = "X-Dongflix-Key",
  body?: Record<string, unknown>,
) {
  if (!key) throw new Error("worker_key_missing");
  try {
    return await requestWorkerViaPublicDns(url, key, keyHeader, body);
  } catch (publicDnsError) {
    // Some serverless hosts block outbound DNS on port 53 even though their
    // normal resolver is healthy. Keep production portable by falling back to
    // the platform fetch path; the local XL case succeeds on the first path.
    try {
      const response = await fetch(url, {
        method: body ? "POST" : "GET",
        headers: { [keyHeader]: key, ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`worker_${response.status}`);
      return recordValue(await response.json());
    } catch {
      throw publicDnsError;
    }
  }
}

export async function loadHomeCatalog(): Promise<HomeCatalog> {
  const donghuaKey = process.env.DONGFLIX_DONGHUA_WORKER_KEY;
  const animeKey = process.env.DONGFLIX_ANIME_WORKER_KEY;

  const requests: Record<SourceName, Promise<Record<string, unknown>>> = {
    donghua: requestWorker(`${DONGHUA_ORIGIN}/api/home/1`, donghuaKey),
    anime: requestWorker(`${ANIME_ORIGIN}/api/anime/ongoing/1`, animeKey),
    film: requestWorker(`${DONGHUA_ORIGIN}/api/lk21/home/1`, donghuaKey),
  };

  const names = Object.keys(requests) as SourceName[];
  const results = await Promise.allSettled(names.map((name) => requests[name]));
  const payload = new Map<SourceName, Record<string, unknown>>();
  const unavailable: string[] = [];

  results.forEach((result, index) => {
    const name = names[index];
    if (result.status === "fulfilled") payload.set(name, result.value);
    else unavailable.push(name);
  });

  const donghua = payload.get("donghua") ?? {};
  const anime = payload.get("anime") ?? {};
  const film = payload.get("film") ?? {};

  return {
    donghua: parseItems(donghua.latest_release ?? donghua.ongoing),
    anime: parseItems(anime.data ?? anime.ongoing_anime ?? anime.latest_release),
    films: parseItems(
      film.ongoing_donghua ?? film.completed_donghua ?? film.latest_release ?? film.data,
    ),
    unavailable,
  };
}

export async function loadCatalogPage(category: CatalogCategory, page: number) {
  const donghuaKey = process.env.DONGFLIX_DONGHUA_WORKER_KEY;
  const animeKey = process.env.DONGFLIX_ANIME_WORKER_KEY;
  const safePage = Math.max(1, Math.min(500, Math.trunc(page)));

  if (category === "donghua") {
    const payload = await requestWorker(`${DONGHUA_ORIGIN}/api/home/${safePage}`, donghuaKey);
    return parseItems(payload.latest_release ?? payload.ongoing);
  }

  if (category === "anime") {
    const payload = await requestWorker(
      `${ANIME_ORIGIN}/api/anime/ongoing/${safePage}`,
      animeKey,
    );
    return parseItems(payload.data ?? payload.ongoing_anime ?? payload.latest_release);
  }

  const payload = await requestWorker(`${DONGHUA_ORIGIN}/api/lk21/home/${safePage}`, donghuaKey);
  return parseItems(
    payload.ongoing_donghua ??
      payload.completed_donghua ??
      payload.latest_release ??
      payload.data,
  );
}

export async function loadDonghuaDetail(requestedSlug: string) {
  const donghuaKey = process.env.DONGFLIX_DONGHUA_WORKER_KEY;
  const slug = requestedSlug === "swallowed-star" || requestedSlug === "swallowed-star-season-3"
    ? "swallowed-star-season-4"
    : requestedSlug;
  const raw = await requestWorker(
    `${DONGHUA_ORIGIN}/api/detail/${encodeURIComponent(slug)}`,
    donghuaKey,
  );
  const payload = raw.data && typeof raw.data === "object" ? raw.data : raw;
  return parseDonghuaDetail(payload);
}

export async function loadDonghuaEpisode(slug: string) {
  const donghuaKey = process.env.DONGFLIX_DONGHUA_WORKER_KEY;
  const raw = await requestWorker(
    `${DONGHUA_ORIGIN}/api/episode/${encodeURIComponent(slug)}`,
    donghuaKey,
  );
  const payload = raw.data && typeof raw.data === "object" ? raw.data : raw;
  return parseDonghuaEpisode(payload);
}

export async function loadAnimeDetail(slug: string) {
  const animeKey = process.env.DONGFLIX_ANIME_WORKER_KEY;
  const raw = await requestWorker(
    `${ANIME_ORIGIN}/api/anime/detail/${encodeURIComponent(slug)}`,
    animeKey,
  );
  const payload = raw.data && typeof raw.data === "object" ? raw.data : raw;
  return parseAnimeDetail(payload);
}

export async function loadAnimeEpisode(slug: string) {
  const animeKey = process.env.DONGFLIX_ANIME_WORKER_KEY;
  const raw = await requestWorker(
    `${ANIME_ORIGIN}/api/anime/episode/${encodeURIComponent(slug)}`,
    animeKey,
  );
  const payload = raw.data && typeof raw.data === "object" ? raw.data : raw;
  return { episode: parseDonghuaEpisode(payload), raw: recordValue(payload) };
}

export async function loadMovieDetail(slug: string) {
  const workerKey = process.env.DONGFLIX_DONGHUA_WORKER_KEY;
  const raw = await requestWorker(
    `${DONGHUA_ORIGIN}/api/lk21/detail/${encodeURIComponent(slug)}?refresh=true`,
    workerKey,
  );
  const payload = raw.data && typeof raw.data === "object" ? raw.data : raw;
  return parseAnimeDetail(payload);
}

export async function loadMovieEpisode(slug: string) {
  const workerKey = process.env.DONGFLIX_DONGHUA_WORKER_KEY;
  const raw = await requestWorker(
    `${DONGHUA_ORIGIN}/api/lk21/episode/${encodeURIComponent(slug)}?refresh=true`,
    workerKey,
  );
  const payload = raw.data && typeof raw.data === "object" ? raw.data : raw;
  return { episode: parseDonghuaEpisode(payload), raw: recordValue(payload) };
}

async function animeMp4Downloads(payload: Record<string, unknown>) {
  const downloads = Object.entries(recordValue(payload.download_url)).flatMap(([label, providers]) => {
    if (!label.toLowerCase().startsWith("mp4_")) return [];
    const quality = label.match(/(\d{3,4})p/i)?.[1];
    const pdrain = recordValue(providers).Pdrain;
    return quality && typeof pdrain === "string" && pdrain.startsWith("https://")
      ? [{ quality: `${quality}p`, url: pdrain }]
      : [];
  });
  return Promise.all(downloads.map(async (source) => {
    try {
      const response = await fetch(source.url, {
        redirect: "manual",
        signal: AbortSignal.timeout(4_000),
      });
      const location = response.headers.get("location");
      return location?.startsWith("https://pixeldrain.com/u/")
        ? { ...source, url: location }
        : source;
    } catch {
      return source;
    }
  }));
}

export async function loadResolvedDonghuaSources(slug: string): Promise<DongflixResolvedSource[]> {
  const resolverUrl = process.env.DONGFLIX_RESOLVER_WORKER_URL?.replace(/\/+$/, "");
  const resolverKey = process.env.DONGFLIX_RESOLVER_WORKER_KEY;
  if (!resolverUrl || !resolverKey) return [];
  const episode = await loadDonghuaEpisode(slug);
  if (episode.sources.length === 0) return [];
  const raw = await requestWorker(
    `${resolverUrl}/api/resolve`,
    resolverKey,
    "X-Dongflix-Resolver-Key",
    { sources: episode.sources },
  );
  const value = Array.isArray(raw.sources) ? raw.sources : [];
  return value.flatMap((entry) => {
    const source = recordValue(entry);
    const url = typeof source.url === "string" ? source.url : "";
    const directUrl = typeof source.directUrl === "string" ? source.directUrl : undefined;
    const proxyUrl = typeof source.proxyUrl === "string" ? source.proxyUrl : url;
    const quality = typeof source.quality === "string" ? source.quality : "720p";
    const container = source.container === "hls" ? "hls" : "mp4";
    return proxyUrl ? [{ url: directUrl ?? proxyUrl, directUrl, proxyUrl, quality, container }] : [];
  });
}

export async function loadResolvedAnimeSources(slug: string): Promise<DongflixResolvedSource[]> {
  const resolverUrl = process.env.DONGFLIX_ANIME_RESOLVER_WORKER_URL?.replace(/\/+$/, "");
  const resolverKey =
    process.env.DONGFLIX_ANIME_RESOLVER_WORKER_KEY ??
    process.env.DONGFLIX_RESOLVER_WORKER_KEY;
  if (!resolverUrl || !resolverKey) return [];
  const { episode, raw } = await loadAnimeEpisode(slug);
  const uniqueQualities = new Set<string>();
  const candidates = episode.sources.filter((source) => {
    const quality = source.name.match(/\d{3,4}p/i)?.[0] ?? "";
    if (!quality) return source.name.toLowerCase().includes("main server");
    if (uniqueQualities.has(quality)) return false;
    uniqueQualities.add(quality);
    return true;
  });
  const sources = (await Promise.all(candidates.map(async (source) => {
    if (!source.url.startsWith("/")) return source;
    try {
      const response = await fetch(`${ANIME_ORIGIN}${source.url}`, {
        headers: process.env.DONGFLIX_ANIME_WORKER_KEY
          ? { "X-Dongflix-Key": process.env.DONGFLIX_ANIME_WORKER_KEY }
          : undefined,
        redirect: "manual",
        signal: AbortSignal.timeout(4_000),
      });
      const location = response.headers.get("location");
      return location ? { ...source, url: location } : null;
    } catch {
      return null;
    }
  }))).filter((source): source is NonNullable<typeof source> => source !== null);
  const downloads = await animeMp4Downloads(raw);
  if (sources.length === 0 && downloads.length === 0) return [];
  const response = await requestWorker(
    `${resolverUrl}/api/resolve`,
    resolverKey,
    "X-Dongflix-Resolver-Key",
    { sources, downloads: [] },
  );
  const value = Array.isArray(response.sources) ? response.sources : [];
  const resolved: DongflixResolvedSource[] = value.flatMap((entry) => {
    const source = recordValue(entry);
    const url = typeof source.url === "string" ? source.url : "";
    const directUrl = typeof source.directUrl === "string" ? source.directUrl : undefined;
    const proxyUrl = typeof source.proxyUrl === "string" ? source.proxyUrl : url;
    const quality = typeof source.quality === "string" ? source.quality : "720p";
    const container = source.container === "hls" ? "hls" : "mp4";
    return proxyUrl ? [{ url: directUrl ?? proxyUrl, directUrl, proxyUrl, quality, container }] : [];
  });
  const availableQualities = new Set(resolved.map((source) => source.quality));
  const mediaSecret = process.env.DONGFLIX_ANIME_RESOLVER_WORKER_KEY
    ?? process.env.DONGFLIX_RESOLVER_WORKER_KEY;
  const downloadSources = downloads.flatMap((source) => {
    if (!mediaSecret || availableQualities.has(source.quality)) return [];
    const id = source.url.match(/^https:\/\/pixeldrain\.com\/u\/([A-Za-z0-9_-]+)\/?$/)?.[1];
    if (!id) return [];
    const directUrl = `https://pixeldrain.com/api/file/${id}`;
    const expires = Date.now() + 10 * 60_000;
    const signature = createHmac("sha256", mediaSecret)
      .update(`${id}:${expires}`)
      .digest("base64url");
    return [{
      url: directUrl,
      directUrl,
      proxyUrl: `/api/anime/media/${id}?expires=${expires}&signature=${signature}`,
      quality: source.quality,
      container: "mp4" as const,
    }];
  });
  return [...resolved, ...downloadSources].sort((left, right) =>
    Number.parseInt(right.quality, 10) - Number.parseInt(left.quality, 10));
}

export async function loadResolvedMovieSources(slug: string): Promise<DongflixResolvedSource[]> {
  const resolverUrl = process.env.DONGFLIX_ANIME_RESOLVER_WORKER_URL?.replace(/\/+$/, "");
  const resolverKey = process.env.DONGFLIX_ANIME_RESOLVER_WORKER_KEY
    ?? process.env.DONGFLIX_RESOLVER_WORKER_KEY;
  if (!resolverUrl || !resolverKey) return [];
  const { episode } = await loadMovieEpisode(slug);
  if (episode.sources.length === 0) return [];
  const response = await requestWorker(
    `${resolverUrl}/api/resolve`,
    resolverKey,
    "X-Dongflix-Resolver-Key",
    { sources: episode.sources, downloads: [] },
  );
  const values = Array.isArray(response.sources) ? response.sources : [];
  return values.flatMap((entry) => {
    const source = recordValue(entry);
    const workerProxy = typeof source.proxyUrl === "string" ? source.proxyUrl : "";
    if (!workerProxy) return [];
    const token = new URL(workerProxy).searchParams.get("token");
    if (!token) return [];
    const directUrl = typeof source.directUrl === "string" ? source.directUrl : workerProxy;
    return [{
      url: directUrl,
      directUrl,
      proxyUrl: workerProxy,
      quality: typeof source.quality === "string" ? source.quality : "720p",
      container: source.container === "hls" ? "hls" as const : "mp4" as const,
    }];
  });
}
