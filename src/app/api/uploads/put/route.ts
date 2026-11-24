import { Readable } from "node:stream";
import type { ReadableStream as NodeWebStream } from "node:stream/web";
import { getSession } from "@/server/auth/session";
import { openUploadTicket } from "@/server/files";
import { isSameOrigin, json, jsonError } from "@/server/http";
import { putObject, storageDriver, StorageError } from "@/server/storage";

/** Step 2 on local storage: the browser streams the file body here and it is written to disk. */
export async function PUT(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Forbidden", 403);
  if (storageDriver() !== "local") return jsonError("Uploads go directly to the storage bucket.", 400);

  const session = await getSession();
  const ticket = openUploadTicket(new URL(request.url).searchParams.get("ticket"));
  if (!session || !ticket || ticket.userId !== session.user.id) return jsonError("This upload link is no longer valid.", 401);
  if (!request.body) return jsonError("The file was empty.");

  try {
    // Allow a little slack over the declared size; anything larger is cut off and removed.
    const { size } = await putObject(
      ticket.key,
      Readable.fromWeb(request.body as unknown as NodeWebStream<Uint8Array>),
      ticket.mimeType,
      ticket.size + 1024,
    );
    return json({ ok: true, size });
  } catch (error) {
    if (error instanceof StorageError) return jsonError(error.message, 413);
    console.error("[uploads] write failed", error);
    return jsonError("The upload was interrupted. Please try again.", 500);
  }
}
