import { getSession } from "@/server/auth/session";
import { sealUploadTicket } from "@/server/files";
import { isSameOrigin, json, jsonError, readJson } from "@/server/http";
import { buildStorageKey, presignUpload, storageDriver } from "@/server/storage";
import { canUpload, isUploadPurpose, resolveMimeType, uploadRule, validateUpload } from "@/server/storage/uploads";

/**
 * Step 1 of an upload: checks the file is acceptable and tells the browser where to send it —
 * straight to the bucket (S3-compatible storage) or to this server (local disk storage).
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Forbidden", 403);
  const session = await getSession();
  if (!session) return jsonError("Please sign in again.", 401);

  const body = await readJson<{ fileName?: string; mimeType?: string; size?: number; purpose?: string }>(request);
  if (!body || typeof body.fileName !== "string" || typeof body.size !== "number" || !isUploadPurpose(body.purpose)) {
    return jsonError("Invalid upload request.");
  }
  if (!canUpload(session.user, body.purpose)) return jsonError("You don't have permission to upload files here.", 403);

  const mimeType = resolveMimeType(body.fileName, body.mimeType);
  const problem = validateUpload(body.purpose, { name: body.fileName, type: mimeType, size: body.size });
  if (problem) return jsonError(problem);

  const key = buildStorageKey(body.fileName, uploadRule(body.purpose).visibility);
  const ticket = sealUploadTicket({
    key,
    userId: session.user.id,
    purpose: body.purpose,
    fileName: body.fileName.slice(0, 200),
    mimeType,
    size: body.size,
    expires: Date.now() + 6 * 60 * 60 * 1000,
  });

  if (storageDriver() === "s3") {
    return json({ mode: "direct", uploadUrl: await presignUpload(key, 6 * 60 * 60), ticket, mimeType });
  }
  return json({ mode: "server", uploadUrl: `/api/uploads/put?ticket=${encodeURIComponent(ticket)}`, ticket, mimeType });
}
