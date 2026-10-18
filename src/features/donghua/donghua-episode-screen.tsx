"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Expand,
  ExternalLink,
  FastForward,
  LoaderCircle,
  MessageSquareText,
  MoreHorizontal,
  Pause,
  Play,
  Rewind,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useRouter } from "next/navigation";

import type { DongflixResolvedSource, DonghuaDetail, DonghuaEpisodeDetail } from "@/lib/catalog";
import { webApiUrl } from "@/lib/web-api";

function episodeNumber(value: string) {
  return Number.parseInt(value.match(/(?:episode|ep)[-_\s]*(\d+)/i)?.[1] ?? "", 10) || null;
}

function withKnownNavigation(episode: DonghuaEpisodeDetail, detail: DonghuaDetail, currentSlug: string) {
  const currentNumber = episodeNumber(`${currentSlug} ${episode.title} ${episode.episodeTitle}`);
  if (currentNumber === null) return episode;

  let previousSlug = "";
  let nextSlug = "";
  let previousNumber = Number.NEGATIVE_INFINITY;
  let nextNumber = Number.POSITIVE_INFINITY;
  for (const item of detail.episodes) {
    const number = episodeNumber(`${item.slug} ${item.title}`);
    if (number === null || item.slug === currentSlug) continue;
    if (number < currentNumber && number > previousNumber) {
      previousNumber = number;
      previousSlug = item.slug;
    }
    if (number > currentNumber && number < nextNumber) {
      nextNumber = number;
      nextSlug = item.slug;
    }
  }
  return { ...episode, previousSlug, nextSlug };
}

function displayEpisodeTitle(episode: DonghuaEpisodeDetail) {
  const number = episodeNumber(`${episode.episodeTitle} ${episode.title}`);
  return number === null ? episode.episodeTitle || episode.title || "Episode Donghua" : `Episode ${number}`;
}

function PlayerSkeleton() {
  return (
    <main className="watch-page" aria-label="Memuat episode Donghua">
      <div className="watch-player watch-player-skeleton"><LoaderCircle /></div>
      <div className="watch-server-skeleton" />
      <div className="watch-actions-skeleton" />
      <div className="watch-title-skeleton" />
    </main>
  );
}

function DongflixVideo({
  source,
  title,
  onReady,
  onPlaybackError,
  onFullscreen,
}: {
  source: DongflixResolvedSource;
  title: string;
  onReady: () => void;
  onPlaybackError: () => void;
  onFullscreen: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const resumeAtRef = useRef(0);
  const resumePlayingRef = useRef(false);
  const fallbackPendingRef = useRef(false);
  const [playbackUrl, setPlaybackUrl] = useState(() => source.directUrl ?? source.proxyUrl);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const isAnimeDownload = source.directUrl?.includes("pixeldrain.com") ?? false;
  const isResolverProxy = source.directUrl?.includes("anime-movie.fikrixdino.workers.dev") ?? false;

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds)) return "0:00";
    const rounded = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(rounded / 3600);
    const minutes = Math.floor((rounded % 3600) / 60);
    const rest = rounded % 60;
    return hours > 0
      ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
      : `${minutes}:${String(rest).padStart(2, "0")}`;
  };

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  };

  const seekBy = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(Math.max(video.currentTime + seconds, 0), video.duration || 0);
  };

  const fallbackToProxy = useCallback(() => {
    if (fallbackPendingRef.current) return;
    if (playbackUrl === source.proxyUrl) {
      onPlaybackError();
      return;
    }
    fallbackPendingRef.current = true;
    const video = videoRef.current;
    resumeAtRef.current = video?.currentTime ?? 0;
    resumePlayingRef.current = Boolean(video && !video.paused);
    setPlaybackUrl(source.proxyUrl);
  }, [onPlaybackError, playbackUrl, source.proxyUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let destroyed = false;
    let hls: { destroy(): void } | null = null;

    if (source.container === "hls" && !video.canPlayType("application/vnd.apple.mpegurl")) {
      void import("hls.js").then(({ default: Hls }) => {
        if (destroyed || !Hls.isSupported()) return;
        const instance = new Hls({ enableWorker: true, lowLatencyMode: false });
        hls = instance;
        instance.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal && !destroyed) fallbackToProxy();
        });
        instance.loadSource(playbackUrl);
        instance.attachMedia(video);
      });
    } else {
      video.src = playbackUrl;
    }
    if (playbackUrl === source.proxyUrl) fallbackPendingRef.current = false;
    const directTimeout = playbackUrl !== source.proxyUrl
      ? window.setTimeout(() => {
          if (!destroyed && video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) fallbackToProxy();
        }, isAnimeDownload || isResolverProxy ? 2_500 : 8_000)
      : undefined;
    return () => {
      destroyed = true;
      if (directTimeout) window.clearTimeout(directTimeout);
      hls?.destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, [fallbackToProxy, isAnimeDownload, isResolverProxy, playbackUrl, source.container, source.proxyUrl]);

  return (
    <div className="dongflix-video-shell">
      <video
        ref={videoRef}
        playsInline
        preload={isAnimeDownload || isResolverProxy ? "auto" : "metadata"}
        onClick={togglePlayback}
        onCanPlay={onReady}
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration);
          if (resumeAtRef.current > 0) {
            event.currentTarget.currentTime = Math.min(resumeAtRef.current, event.currentTarget.duration || resumeAtRef.current);
            resumeAtRef.current = 0;
          }
          if (resumePlayingRef.current) {
            resumePlayingRef.current = false;
            void event.currentTarget.play();
          }
          onReady();
        }}
        onDurationChange={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onVolumeChange={(event) => setMuted(event.currentTarget.muted || event.currentTarget.volume === 0)}
        onError={fallbackToProxy}
      />
      <div className="dongflix-player-title">{title}</div>
      <button className="dongflix-center-play" type="button" onClick={togglePlayback} aria-label={playing ? "Jeda" : "Putar"}>
        {playing ? <Pause /> : <Play />}
      </button>
      <div className="dongflix-controls">
        <input
          aria-label="Posisi video"
          type="range"
          min="0"
          max={duration || 0}
          step="0.1"
          value={Math.min(currentTime, duration || 0)}
          onChange={(event) => {
            const video = videoRef.current;
            if (video) video.currentTime = Number(event.target.value);
          }}
          style={{ "--watch-progress": `${duration > 0 ? (currentTime / duration) * 100 : 0}%` } as React.CSSProperties}
        />
        <div className="dongflix-control-row">
          <button type="button" onClick={togglePlayback} aria-label={playing ? "Jeda" : "Putar"}>{playing ? <Pause /> : <Play />}</button>
          <button type="button" onClick={() => seekBy(-10)} aria-label="Mundur 10 detik"><Rewind /><small>10</small></button>
          <button type="button" onClick={() => seekBy(10)} aria-label="Maju 10 detik"><FastForward /><small>10</small></button>
          <span className="dongflix-time">{formatTime(currentTime)} / {formatTime(duration)}</span>
          <button
            type="button"
            onClick={() => {
              const video = videoRef.current;
              if (video) video.muted = !video.muted;
            }}
            aria-label={muted ? "Aktifkan suara" : "Bisukan suara"}
          >{muted ? <VolumeX /> : <Volume2 />}</button>
          <button type="button" onClick={onFullscreen} aria-label="Layar penuh"><Expand /></button>
        </div>
      </div>
    </div>
  );
}

export function DonghuaEpisodeScreen({
  showSlug,
  episodeSlug,
  kind = "donghua",
}: {
  showSlug: string;
  episodeSlug: string;
  kind?: "donghua" | "anime" | "movie";
}) {
  const router = useRouter();
  const apiBase = kind === "anime" ? "/api/anime" : kind === "movie" ? "/api/movie" : "/api/donghua";
  const routeBase = kind === "anime" ? "/anime" : kind === "movie" ? "/movie" : "/donghua";
  const frameRef = useRef<HTMLDivElement>(null);
  const [episode, setEpisode] = useState<DonghuaEpisodeDetail | null>(null);
  const [resolvedSources, setResolvedSources] = useState<DongflixResolvedSource[]>([]);
  const [activeResolvedSource, setActiveResolvedSource] = useState(-1);
  const [resolverLoading, setResolverLoading] = useState(true);
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [frameLoading, setFrameLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showMoreServers, setShowMoreServers] = useState(false);

  const loadEpisode = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [episodeResponse, detailResponse] = await Promise.all([
        fetch(webApiUrl(`${apiBase}/episode/${encodeURIComponent(episodeSlug)}`), { cache: "no-store" }),
        fetch(webApiUrl(`${apiBase}/${encodeURIComponent(showSlug)}`), { cache: "no-store" }),
      ]);
      if (!episodeResponse.ok) throw new Error("episode_unavailable");
      const data = (await episodeResponse.json()) as DonghuaEpisodeDetail;
      const detail = detailResponse.ok ? (await detailResponse.json()) as DonghuaDetail : null;
      setEpisode(detail ? withKnownNavigation(data, detail, episodeSlug) : data);
      setResolvedSources([]);
      setActiveResolvedSource(-1);
      setResolverLoading(true);
      setPlaybackFailed(false);
      setFrameLoading(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [apiBase, episodeSlug, showSlug]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${apiBase}/resolve/${encodeURIComponent(episodeSlug)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => response.ok ? response.json() as Promise<{ sources?: DongflixResolvedSource[] }> : { sources: [] })
      .then((payload) => {
        if (controller.signal.aborted || !Array.isArray(payload.sources) || payload.sources.length === 0) return;
        setResolvedSources(payload.sources);
        setActiveResolvedSource(0);
        setFrameLoading(true);
      })
      .catch(() => {
        // The download-app option remains available when the independent resolver is offline.
      })
      .finally(() => {
        if (!controller.signal.aborted) setResolverLoading(false);
      });
    return () => controller.abort();
  }, [apiBase, episodeSlug]);

  useEffect(() => {
    const controller = new AbortController();
    const options = { cache: "no-store" as const, signal: controller.signal };
    void Promise.all([
      fetch(webApiUrl(`${apiBase}/episode/${encodeURIComponent(episodeSlug)}`), options),
      fetch(webApiUrl(`${apiBase}/${encodeURIComponent(showSlug)}`), options),
    ])
      .then(async ([episodeResponse, detailResponse]) => {
        if (!episodeResponse.ok) throw new Error("episode_unavailable");
        const data = (await episodeResponse.json()) as DonghuaEpisodeDetail;
        const detail = detailResponse.ok ? (await detailResponse.json()) as DonghuaDetail : null;
        return detail ? withKnownNavigation(data, detail, episodeSlug) : data;
      })
      .then((data) => {
        setEpisode(data);
        setFrameLoading(true);
      })
      .catch((requestError: unknown) => {
        if (!(requestError instanceof DOMException && requestError.name === "AbortError")) {
          setError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [apiBase, episodeSlug, showSlug]);

  const openEpisode = (slug: string) => {
    if (!slug) return;
    router.push(`${routeBase}/${encodeURIComponent(showSlug)}/episode/${encodeURIComponent(slug)}`);
  };

  const enterFullscreen = async () => {
    try {
      await frameRef.current?.requestFullscreen();
    } catch {
      // Browser fullscreen can be denied when the action is not user initiated.
    }
  };

  const handlePlaybackError = useCallback(() => {
    setActiveResolvedSource(-1);
    setFrameLoading(false);
    setPlaybackFailed(true);
  }, []);

  if (loading && !episode) return <PlayerSkeleton />;

  if (error && !episode) {
    return (
      <main className="watch-page">
        <header className="watch-error-bar">
          <button type="button" onClick={() => router.push(`${routeBase}/${encodeURIComponent(showSlug)}`)} aria-label="Kembali ke detail"><ChevronLeft /></button>
        </header>
        <section className="error-state watch-error-state">
          <span className="error-mark">DF</span>
          <h1>Episode belum bisa dimuat</h1>
          <p>Periksa koneksi atau pilih episode lain, lalu coba lagi.</p>
          <button type="button" onClick={() => void loadEpisode()}>Coba lagi</button>
        </section>
      </main>
    );
  }

  if (!episode) return null;
  const selectedResolvedSource = activeResolvedSource >= 0 ? resolvedSources[activeResolvedSource] : null;

  return (
    <main className="watch-page">
      <section className="watch-player" ref={frameRef}>
        {selectedResolvedSource ? (
          <DongflixVideo
            key={`${selectedResolvedSource.quality}-${selectedResolvedSource.proxyUrl}`}
            source={selectedResolvedSource}
            title={`${episode.title} — ${displayEpisodeTitle(episode)}`}
            onReady={() => setFrameLoading(false)}
            onPlaybackError={handlePlaybackError}
            onFullscreen={() => void enterFullscreen()}
          />
        ) : resolverLoading ? (
          <div className="watch-player-loading"><LoaderCircle /><span>Menyiapkan server DongFlix...</span></div>
        ) : (
          <div className="watch-no-source">
            <Play />
            <span>{playbackFailed ? "Video DongFlix gagal diputar." : "Server DongFlix belum tersedia."}</span>
            <button type="button" onClick={() => setShowMoreServers(true)}>Lihat opsi lainnya</button>
          </div>
        )}
        {frameLoading && selectedResolvedSource ? (
          <div className="watch-player-loading"><LoaderCircle /><span>Memuat server...</span></div>
        ) : null}
        <button
          className="watch-back"
          type="button"
          onClick={() => router.push(`${routeBase}/${encodeURIComponent(showSlug)}`)}
          aria-label={`Kembali ke detail ${kind === "anime" ? "Anime" : kind === "movie" ? "Film" : "Donghua"}`}
        ><ChevronLeft /></button>
        {!selectedResolvedSource ? <button className="watch-fullscreen" type="button" onClick={() => void enterFullscreen()} aria-label="Layar penuh"><Expand /></button> : null}
      </section>

      {resolvedSources.length > 0 ? (
        <nav className="watch-server-list" aria-label="Pilih server video">
          {resolvedSources.map((source, index) => (
            <button
              className={activeResolvedSource === index ? "active" : ""}
              type="button"
              key={`dongflix-${source.url}-${index}`}
              onClick={() => {
                setActiveResolvedSource(index);
                setPlaybackFailed(false);
                setFrameLoading(true);
              }}
            >DongFlix {source.quality}</button>
          ))}
          <button className="more-server-button" type="button" onClick={() => setShowMoreServers(true)}>
            <MoreHorizontal /> More Server
          </button>
        </nav>
      ) : !resolverLoading ? (
        <nav className="watch-server-list watch-server-list-empty" aria-label="Server lainnya">
          <button className="more-server-button" type="button" onClick={() => setShowMoreServers(true)}>
            <MoreHorizontal /> More Server
          </button>
        </nav>
      ) : null}

      <div className="watch-body">
        <div className="watch-navigation">
          <button type="button" disabled={!episode.previousSlug} onClick={() => openEpisode(episode.previousSlug)}>
            <ChevronLeft /><span>Ep Sebelumnya</span>
          </button>
          <button className="next" type="button" disabled={!episode.nextSlug} onClick={() => openEpisode(episode.nextSlug)}>
            <span>Ep Selanjutnya</span><ChevronRight />
          </button>
        </div>

        <h1>{displayEpisodeTitle(episode)}</h1>

        <button className="watch-comments" type="button" onClick={() => setShowComments(true)}>
          <MessageSquareText /><span>Diskusi &amp; Komentar</span>
        </button>
      </div>

      {showComments ? (
        <div className="comments-sheet-backdrop" role="presentation" onClick={() => setShowComments(false)}>
          <section className="comments-sheet" role="dialog" aria-modal="true" aria-label="Diskusi dan komentar" onClick={(event) => event.stopPropagation()}>
            <span className="comments-sheet-handle" />
            <h2>Diskusi &amp; Komentar</h2>
            <div className="comments-empty"><MessageSquareText /><p>Belum ada komentar di episode ini.</p></div>
            <button type="button" onClick={() => setShowComments(false)}>Tutup</button>
          </section>
        </div>
      ) : null}

      {showMoreServers ? (
        <div className="server-modal-backdrop" role="presentation" onClick={() => setShowMoreServers(false)}>
          <section className="server-dialog" role="dialog" aria-modal="true" aria-label="Server lainnya" onClick={(event) => event.stopPropagation()}>
            <span className="server-dialog-icon"><ExternalLink /></span>
            <h2>Butuh server lainnya?</h2>
            <p>Server tambahan tersedia lengkap di aplikasi DongFlix.</p>
            <a href="https://dongflix-download.vercel.app" target="_blank" rel="noreferrer">
              Unduh aplikasi <ExternalLink />
            </a>
            <button type="button" onClick={() => setShowMoreServers(false)}>Nanti saja</button>
          </section>
        </div>
      ) : null}

      {error ? (
        <button className="watch-retry-toast" type="button" onClick={() => void loadEpisode()}><RotateCcw /> Muat ulang</button>
      ) : null}
    </main>
  );
}
