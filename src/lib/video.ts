import type { VideoProvider } from "@/generated/prisma/enums";

export function youtubeId(input: string | null | undefined) {
  if (!input) return null;
  const value = input.trim();
  if (/^[\w-]{11}$/.test(value)) return value;
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return url.pathname.slice(1, 12) || null;
    if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "music.youtube.com") {
      const v = url.searchParams.get("v");
      if (v) return v;
      const match = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/);
      if (match) return match[1];
    }
  } catch {
    return null;
  }
  return null;
}

export function vimeoId(input: string | null | undefined) {
  if (!input) return null;
  const value = input.trim();
  if (/^\d{6,12}$/.test(value)) return { id: value, hash: null as string | null };
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const match = url.pathname.match(/(?:\/video)?\/(\d{6,12})(?:\/([0-9a-f]+))?/);
      if (match) return { id: match[1], hash: match[2] ?? url.searchParams.get("h") };
    }
  } catch {
    return null;
  }
  return null;
}

/** Best guess at where a pasted video link is hosted. */
export function detectVideoProvider(input: string | null | undefined): VideoProvider | null {
  if (!input) return null;
  const value = input.trim();
  if (!value) return null;
  if (youtubeId(value) && /youtu/.test(value)) return "YOUTUBE";
  if (vimeoId(value) && /vimeo/.test(value)) return "VIMEO";
  if (/mediadelivery\.net|bunnycdn|b-cdn\.net/.test(value) && /\/embed\/|iframe/.test(value)) return "BUNNY";
  if (/^https?:\/\//.test(value)) return "URL";
  return null;
}

export function isHlsUrl(url: string) {
  return /\.m3u8(\?|$)/i.test(url);
}

/** Embed URL for providers that are played inside an iframe. Returns null for native playback. */
export function videoEmbedUrl(provider: VideoProvider | null | undefined, value: string | null | undefined) {
  if (!provider || !value) return null;
  if (provider === "YOUTUBE") {
    const id = youtubeId(value);
    return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1` : null;
  }
  if (provider === "VIMEO") {
    const parsed = vimeoId(value);
    if (!parsed) return null;
    const hash = parsed.hash ? `&h=${parsed.hash}` : "";
    return `https://player.vimeo.com/video/${parsed.id}?dnt=1&title=0&byline=0&portrait=0${hash}`;
  }
  if (provider === "BUNNY") {
    return /^https:\/\//.test(value) ? value : null;
  }
  return null;
}

export const VIDEO_PROVIDER_LABELS: Record<VideoProvider, string> = {
  YOUTUBE: "YouTube",
  VIMEO: "Vimeo",
  BUNNY: "Bunny Stream",
  UPLOAD: "Uploaded file",
  URL: "Direct video link",
};
