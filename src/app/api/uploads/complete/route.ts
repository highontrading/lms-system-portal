import { getSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { openUploadTicket } from "@/server/files";
import { isSameOrigin, json, jsonError, readJson } from "@/server/http";
import { deleteObject, fileUrl, statObject } from "@/server/storage";
import { uploadRule } from "@/server/storage/uploads";

/** Final step: confirms the file really arrived in storage and records it in the media library. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Forbidden", 403);
  const session = await getSession();
  const body = await readJson<{ ticket?: string }>(request);
  const ticket = openUploadTicket(body?.ticket);
  if (!session || !ticket || ticket.userId !== session.user.id) return jsonError("This upload is no longer valid.", 401);

  const stored = await statObject(ticket.key);
  if (!stored) return jsonError("The file didn't finish uploading. Please try again.");

  const rule = uploadRule(ticket.purpose);
  if (stored.size > rule.maxBytes) {
    await deleteObject(ticket.key);
    return jsonError(`That file is too large. ${rule.describe}.`, 413);
  }

  const media = await db.media.upsert({
    where: { key: ticket.key },
    update: {},
    create: {
      key: ticket.key,
      fileName: ticket.fileName,
      mimeType: ticket.mimeType,
      size: stored.size,
      visibility: rule.visibility,
      uploadedById: session.user.id,
    },
  });

  return json({
    id: media.id,
    key: media.key,
    url: fileUrl(media.key),
    fileName: media.fileName,
    mimeType: media.mimeType,
    size: media.size,
    visibility: media.visibility,
  });
}
