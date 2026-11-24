"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import type { VideoProvider } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { isHlsUrl, videoEmbedUrl, vimeoId, youtubeId } from "@/lib/video";

export type VideoPlayerProps = {
  provider: VideoProvider;
  /** A YouTube/Vimeo link or id, a Bunny embed URL, a direct video URL, or a `/files/...` upload. */
  url: string;
  title: string;
  poster?: string | null;
  /** Resume position in seconds. */
  startAt?: number;
  /** Reported every few seconds while playing, and when playback pauses. */
  onProgress?: (seconds: number, duration: number) => void;
  onEnded?: () => void;
  className?: string;
};

const REPORT_INTERVAL_MS = 5000;

/** Latest value of a prop inside long-lived effects, without re-running them. */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

/**
 * One player for every video source. Uploads and direct links play natively (with HLS
 * support); YouTube and Vimeo are embedded with their player APIs so progress and
 * completion are tracked the same way everywhere.
 */
export function VideoPlayer(props: VideoPlayerProps) {
  const { provider, url, className } = props;
  return (
    <div className={cn("relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-md", className)}>
      {provider === "YOUTUBE" && youtubeId(url) ? (
        <YouTubePlayer {...props} />
      ) : provider === "VIMEO" && vimeoId(url) ? (
        <VimeoPlayer {...props} />
      ) : provider === "BUNNY" ? (
        <EmbedFrame src={videoEmbedUrl("BUNNY", url)} title={props.title} />
      ) : (
        <NativePlayer {...props} />
      )}
    </div>
  );
}

function EmbedFrame({ src, title }: { src: string | null; title: string }) {
  if (!src) return <PlayerMessage>This video link isn&apos;t valid.</PlayerMessage>;
  return (
    <iframe
      src={src}
      title={title}
      className="absolute inset-0 size-full border-0"
      loading="lazy"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}

function PlayerMessage({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white/70">{children}</div>;
}

// ───────────────────────────── Native <video> ─────────────────────────────

function NativePlayer({ url, poster, startAt, title, provider, onProgress, onEnded }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastReport = useRef(0);
  const progress = useLatest(onProgress);
  const ended = useLatest(onEnded);
  const hls = isHlsUrl(url);

  // HLS streams need hls.js everywhere except Safari, which plays them natively.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hls) return;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      return;
    }
    let cancelled = false;
    let instance: { destroy: () => void } | null = null;
    import("hls.js").then(({ default: Hls }) => {
      if (cancelled || !Hls.isSupported()) return;
      const player = new Hls();
      player.loadSource(url);
      player.attachMedia(video);
      instance = player;
    });
    return () => {
      cancelled = true;
      instance?.destroy();
    };
  }, [url, hls]);

  // Navigating away keeps this page mounted but hidden; make sure audio doesn't keep playing.
  useLayoutEffect(() => {
    const video = videoRef.current;
    return () => video?.pause();
  }, []);

  const report = (force: boolean) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    const now = Date.now();
    if (!force && now - lastReport.current < REPORT_INTERVAL_MS) return;
    lastReport.current = now;
    progress.current?.(video.currentTime, video.duration);
  };

  return (
    <video
      ref={videoRef}
      src={hls ? undefined : url}
      poster={poster ?? undefined}
      title={title}
      controls
      playsInline
      preload="metadata"
      // Uploaded lessons are for enrolled students; don't advertise a download button.
      controlsList={provider === "UPLOAD" ? "nodownload" : undefined}
      onContextMenu={provider === "UPLOAD" ? (event) => event.preventDefault() : undefined}
      className="absolute inset-0 size-full bg-black"
      onLoadedMetadata={(event) => {
        const video = event.currentTarget;
        if (startAt && startAt > 3 && startAt < video.duration - 5) video.currentTime = startAt;
      }}
      onTimeUpdate={() => report(false)}
      onPause={() => report(true)}
      onEnded={() => {
        report(true);
        ended.current?.();
      }}
    />
  );
}

// ───────────────────────────── YouTube ─────────────────────────────

type YouTubePlayerInstance = {
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  pauseVideo: () => void;
  destroy: () => void;
};

type YouTubeApi = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      host?: string;
      width?: string;
      height?: string;
      playerVars?: Record<string, string | number>;
      events?: { onStateChange?: (event: { data: number }) => void };
    },
  ) => YouTubePlayerInstance;
};

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youTubeApi: Promise<YouTubeApi> | null = null;

function loadYouTubeApi() {
  youTubeApi ??= new Promise<YouTubeApi>((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.head.appendChild(script);
  });
  return youTubeApi;
}

const YT_ENDED = 0;
const YT_PLAYING = 1;
const YT_PAUSED = 2;

function YouTubePlayer({ url, startAt, onProgress, onEnded }: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const resumeAt = useRef(startAt ?? 0);
  const progress = useLatest(onProgress);
  const ended = useLatest(onEnded);
  const videoId = youtubeId(url);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !videoId) return;
    let player: YouTubePlayerInstance | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const report = () => {
      if (!player) return;
      try {
        const seconds = player.getCurrentTime();
        const duration = player.getDuration();
        if (duration > 0) {
          resumeAt.current = seconds;
          progress.current?.(seconds, duration);
        }
      } catch {
        // The player was torn down between ticks.
      }
    };

    loadYouTubeApi().then((YT) => {
      if (cancelled) return;
      // The API replaces its target element with an iframe, so give it one React doesn't own.
      const mount = document.createElement("div");
      container.appendChild(mount);
      player = new YT.Player(mount, {
        videoId,
        host: "https://www.youtube-nocookie.com",
        width: "100%",
        height: "100%",
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          start: Math.floor(resumeAt.current),
          origin: window.location.origin,
        },
        events: {
          onStateChange: (event) => {
            if (event.data === YT_PAUSED) report();
            if (event.data === YT_ENDED) {
              report();
              ended.current?.();
            }
          },
        },
      });
      timer = setInterval(() => {
        try {
          if (player?.getPlayerState() === YT_PLAYING) report();
        } catch {
          // Not ready yet.
        }
      }, REPORT_INTERVAL_MS);
    });

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      try {
        player?.destroy();
      } catch {
        // Already gone.
      }
      container.replaceChildren();
    };
  }, [videoId, progress, ended]);

  return <div ref={containerRef} className="absolute inset-0 [&_iframe]:size-full [&_iframe]:border-0" />;
}

// ───────────────────────────── Vimeo ─────────────────────────────

function VimeoPlayer({ url, title, startAt, onProgress, onEnded }: VideoPlayerProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const lastReport = useRef(0);
  const progress = useLatest(onProgress);
  const ended = useLatest(onEnded);
  const src = videoEmbedUrl("VIMEO", url);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const send = (method: string, value?: unknown) =>
      frame.contentWindow?.postMessage(JSON.stringify(value === undefined ? { method } : { method, value }), "https://player.vimeo.com");
    let seeked = false;

    const subscribe = () => {
      send("addEventListener", "timeupdate");
      send("addEventListener", "ended");
      send("addEventListener", "pause");
      if (!seeked && startAt && startAt > 3) {
        seeked = true;
        send("setCurrentTime", startAt);
      }
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== "https://player.vimeo.com" || event.source !== frame.contentWindow) return;
      let data: { event?: string; data?: { seconds?: number; duration?: number } };
      try {
        data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (data.event === "ready") subscribe();
      if ((data.event === "timeupdate" || data.event === "pause") && data.data?.duration) {
        const now = Date.now();
        if (data.event === "pause" || now - lastReport.current >= REPORT_INTERVAL_MS) {
          lastReport.current = now;
          progress.current?.(data.data.seconds ?? 0, data.data.duration);
        }
      }
      if (data.event === "ended") ended.current?.();
    };

    window.addEventListener("message", onMessage);
    frame.addEventListener("load", subscribe);
    return () => {
      window.removeEventListener("message", onMessage);
      frame.removeEventListener("load", subscribe);
      send("pause");
    };
  }, [src, startAt, progress, ended]);

  if (!src) return <PlayerMessage>This Vimeo link isn&apos;t valid.</PlayerMessage>;
  return (
    <iframe
      ref={frameRef}
      src={`${src}&api=1`}
      title={title}
      className="absolute inset-0 size-full border-0"
      allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}
