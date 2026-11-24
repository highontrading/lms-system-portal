import "server-only";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { AwsClient } from "aws4fetch";
import { slugify } from "@/lib/utils";
import { randomReadable } from "@/server/crypto";

/**
 * File storage with two interchangeable backends:
 *  - "local": files on disk under STORAGE_DIR (great for a VPS or Docker volume)
 *  - "s3":    any S3-compatible bucket (AWS S3, Cloudflare R2, DigitalOcean Spaces, MinIO…)
 *
 * The rest of the app only ever stores a storage key and links to `/files/<key>`,
 * so switching backend never requires rewriting URLs in the database.
 */

export type StorageDriverName = "local" | "s3";

export function storageDriver(): StorageDriverName {
  const explicit = process.env.STORAGE_DRIVER?.toLowerCase();
  if (explicit === "s3" || explicit === "local") return explicit;
  return process.env.S3_BUCKET ? "s3" : "local";
}

export class StorageError extends Error {}

const KEY_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9/_.-]{0,300}$/;

export function assertSafeKey(key: string) {
  if (!KEY_PATTERN.test(key) || key.includes("..") || key.includes("//")) {
    throw new StorageError("Invalid storage key");
  }
  return key;
}

/** "public/2026/11/K7QM2XPA9R-intro-video.mp4" */
export function buildStorageKey(fileName: string, visibility: "PUBLIC" | "PRIVATE", now = new Date()) {
  const extension = path.extname(fileName).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 12);
  const base = slugify(path.basename(fileName, path.extname(fileName))) || "file";
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${visibility === "PUBLIC" ? "public" : "private"}/${year}/${month}/${randomReadable(10)}-${base.slice(0, 60)}${extension}`;
}

export function fileUrl(key: string) {
  return `/files/${key}`;
}

/** Extracts the storage key from a `/files/...` URL (returns null for external URLs). */
export function keyFromFileUrl(url: string | null | undefined) {
  if (!url || !url.startsWith("/files/")) return null;
  const key = url.slice("/files/".length).split("?")[0];
  return KEY_PATTERN.test(key) ? key : null;
}

// ───────────────────────────── Local disk ─────────────────────────────

function localRoot() {
  return path.resolve(process.env.STORAGE_DIR || path.join(process.cwd(), "storage"));
}

function localPath(key: string) {
  const root = localRoot();
  const resolved = path.resolve(root, assertSafeKey(key));
  if (!resolved.startsWith(root + path.sep)) throw new StorageError("Invalid storage key");
  return resolved;
}

async function localPut(key: string, body: Buffer | Readable, maxBytes: number) {
  const target = localPath(key);
  await mkdir(path.dirname(target), { recursive: true });
  let size = 0;
  const meter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      size += chunk.length;
      if (size > maxBytes) callback(new StorageError("File is larger than the allowed size"));
      else callback(null, chunk);
    },
  });
  try {
    await pipeline(Buffer.isBuffer(body) ? Readable.from([body]) : body, meter, createWriteStream(target));
  } catch (error) {
    await rm(target, { force: true });
    throw error;
  }
  return { size };
}

export async function localStat(key: string) {
  try {
    const info = await stat(localPath(key));
    return info.isFile() ? { size: info.size, lastModified: info.mtime } : null;
  } catch {
    return null;
  }
}

export function localReadStream(key: string, range?: { start: number; end: number }) {
  return createReadStream(localPath(key), range);
}

// ───────────────────────────── S3-compatible ─────────────────────────────

type S3Config = { client: AwsClient; endpoint: string; bucket: string; publicBase: string | null };

let s3Cache: S3Config | null = null;

function s3(): S3Config {
  if (s3Cache) return s3Cache;
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new StorageError("S3 storage needs S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.");
  }
  const region = process.env.S3_REGION || "auto";
  const endpoint = (process.env.S3_ENDPOINT || `https://s3.${region}.amazonaws.com`).replace(/\/+$/, "");
  s3Cache = {
    client: new AwsClient({ accessKeyId, secretAccessKey, region, service: "s3" }),
    endpoint,
    bucket,
    publicBase: process.env.S3_PUBLIC_URL?.replace(/\/+$/, "") || null,
  };
  return s3Cache;
}

function s3ObjectUrl(key: string) {
  const { endpoint, bucket } = s3();
  const encoded = assertSafeKey(key).split("/").map(encodeURIComponent).join("/");
  return `${endpoint}/${bucket}/${encoded}`;
}

async function s3Presign(method: "GET" | "PUT", key: string, expiresInSeconds: number, query: Record<string, string> = {}) {
  const url = new URL(s3ObjectUrl(key));
  url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));
  for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
  const signed = await s3().client.sign(new Request(url, { method }), { aws: { signQuery: true } });
  return signed.url;
}

// ───────────────────────────── Public API ─────────────────────────────

export const DEFAULT_MAX_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;

/** Stores a file from the server side (seed data, generated files, streamed browser uploads on local storage). */
export async function putObject(
  key: string,
  body: Buffer | Readable,
  contentType: string,
  maxBytes = DEFAULT_MAX_UPLOAD_BYTES,
) {
  if (storageDriver() === "local") return localPut(key, body, maxBytes);
  const buffer = Buffer.isBuffer(body) ? body : await streamToBuffer(body, maxBytes);
  const response = await s3().client.fetch(s3ObjectUrl(key), {
    method: "PUT",
    body: new Uint8Array(buffer),
    headers: { "Content-Type": contentType },
  });
  if (!response.ok) throw new StorageError(`Upload to storage failed (${response.status})`);
  return { size: buffer.length };
}

async function streamToBuffer(stream: Readable, maxBytes: number) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) throw new StorageError("File is larger than the allowed size");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

export async function statObject(key: string) {
  if (storageDriver() === "local") return localStat(key);
  const response = await s3().client.fetch(s3ObjectUrl(key), { method: "HEAD" });
  if (!response.ok) return null;
  return { size: Number(response.headers.get("content-length") ?? 0), lastModified: undefined };
}

export async function deleteObject(key: string) {
  if (storageDriver() === "local") {
    try {
      await unlink(localPath(key));
    } catch {
      // Already gone.
    }
    return;
  }
  await s3().client.fetch(s3ObjectUrl(key), { method: "DELETE" });
}

/** A URL the browser can upload straight to (S3 only). */
export function presignUpload(key: string, expiresInSeconds = 60 * 60) {
  return s3Presign("PUT", key, expiresInSeconds);
}

/** Where to send a browser that asked for a file kept in the bucket. */
export async function s3DownloadUrl(
  key: string,
  options: { isPublic: boolean; downloadName?: string | null; contentType?: string | null; expiresInSeconds?: number },
) {
  const { publicBase } = s3();
  if (options.isPublic && publicBase && !options.downloadName) {
    return `${publicBase}/${key.split("/").map(encodeURIComponent).join("/")}`;
  }
  const query: Record<string, string> = {};
  if (options.downloadName) {
    query["response-content-disposition"] = `attachment; filename="${options.downloadName.replace(/["\\\r\n]/g, "")}"`;
  }
  if (options.contentType) query["response-content-type"] = options.contentType;
  return s3Presign("GET", key, options.expiresInSeconds ?? 60 * 60, query);
}

export function storageSummary() {
  const driver = storageDriver();
  if (driver === "local") return { driver, detail: localRoot() };
  return { driver, detail: `${process.env.S3_BUCKET ?? ""} @ ${process.env.S3_ENDPOINT ?? "AWS S3"}` };
}
