import { Readable } from "node:stream";
import { getSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { canReadPrivateFile } from "@/server/files";
import { localReadStream, localStat, s3DownloadUrl, storageDriver } from "@/server/storage";
import { canDisplayInline } from "@/server/storage/uploads";

function parseRange(header: string | null, size: number) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === "" && match[2] === "")) return "invalid" as const;
  let start: number;
  let end: number;
  if (match[1] === "") {
    // "bytes=-500" → the final 500 bytes
    const suffix = Number(match[2]);
    if (suffix === 0) return "invalid" as const;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
  }
  if (start > end || start >= size) return "invalid" as const;
  return { start, end };
}

function dispositionName(fileName: string) {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/**
 * Serves every stored file. Public media (thumbnails, logos, images in lessons) is cacheable
 * by anyone; private files (lesson videos, deliverables, submissions) are only sent to people
 * who have access to something that uses them.
 */
export async function GET(request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: segments } = await params;
  const key = segments.join("/");
  const url = new URL(request.url);
  const download = url.searchParams.has("download");

  const media = await db.media.findUnique({ where: { key } });
  if (!media) return new Response("Not found", { status: 404 });

  const isPublic = media.visibility === "PUBLIC";
  if (!isPublic) {
    const session = await getSession();
    if (!(await canReadPrivateFile(session?.user ?? null, key))) {
      return new Response(session ? "You don't have access to this file." : "Please sign in to access this file.", {
        status: session ? 403 : 401,
      });
    }
  }

  const inline = !download && canDisplayInline(media.mimeType);
  const cacheControl = isPublic ? "public, max-age=31536000, immutable" : "private, max-age=600";

  if (storageDriver() === "s3") {
    const target = await s3DownloadUrl(key, {
      isPublic,
      downloadName: inline ? null : media.fileName,
      contentType: media.mimeType,
      expiresInSeconds: 60 * 60,
    });
    return new Response(null, {
      status: 302,
      headers: { Location: target, "Cache-Control": isPublic ? "public, max-age=1800" : "private, no-store" },
    });
  }

  const info = await localStat(key);
  if (!info) return new Response("Not found", { status: 404 });

  const headers = new Headers({
    "Content-Type": media.mimeType,
    "Accept-Ranges": "bytes",
    "Cache-Control": cacheControl,
    "Content-Disposition": `${inline ? "inline" : "attachment"}; ${dispositionName(media.fileName)}`,
    "X-Content-Type-Options": "nosniff",
    // Uploaded files are never allowed to run script, even if opened directly (e.g. an SVG).
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; media-src 'self'; sandbox",
  });

  const range = parseRange(request.headers.get("range"), info.size);
  if (range === "invalid") {
    headers.set("Content-Range", `bytes */${info.size}`);
    return new Response(null, { status: 416, headers });
  }

  if (request.method === "HEAD") {
    headers.set("Content-Length", String(info.size));
    return new Response(null, { status: 200, headers });
  }

  if (range) {
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${info.size}`);
    headers.set("Content-Length", String(range.end - range.start + 1));
    return new Response(Readable.toWeb(localReadStream(key, range)) as unknown as ReadableStream, { status: 206, headers });
  }

  headers.set("Content-Length", String(info.size));
  return new Response(Readable.toWeb(localReadStream(key)) as unknown as ReadableStream, { status: 200, headers });
}

export { GET as HEAD };
