/** Browser-side upload helper. Works the same whether files go to local disk or an S3 bucket. */

export type UploadPurpose = "media" | "private" | "avatar" | "submission";

export type UploadedFile = {
  id: string;
  key: string;
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
  visibility: "PUBLIC" | "PRIVATE";
};

export class UploadFailed extends Error {}

async function readError(response: Response) {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error ?? "The upload failed. Please try again.";
  } catch {
    return "The upload failed. Please try again.";
  }
}

function putWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let message = "The upload failed. Please try again.";
      try {
        message = (JSON.parse(xhr.responseText) as { error?: string }).error ?? message;
      } catch {
        // Storage providers answer with XML; the generic message is fine.
      }
      reject(new UploadFailed(message));
    };
    xhr.onerror = () => reject(new UploadFailed("The connection dropped during the upload. Please try again."));
    xhr.onabort = () => reject(new UploadFailed("Upload cancelled."));
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(file);
  });
}

/**
 * Uploads a file and returns its record. The URL in the result (`/files/...`) is what gets
 * saved on products, lessons, profiles and so on.
 */
export async function uploadFile(
  file: File,
  purpose: UploadPurpose,
  options: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<UploadedFile> {
  const presign = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name, mimeType: file.type, size: file.size, purpose }),
    signal: options.signal,
  });
  if (!presign.ok) throw new UploadFailed(await readError(presign));
  const { uploadUrl, ticket, mimeType } = (await presign.json()) as {
    mode: "direct" | "server";
    uploadUrl: string;
    ticket: string;
    mimeType: string;
  };

  await putWithProgress(uploadUrl, file, mimeType, options.onProgress, options.signal);

  const complete = await fetch("/api/uploads/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticket }),
    signal: options.signal,
  });
  if (!complete.ok) throw new UploadFailed(await readError(complete));
  return (await complete.json()) as UploadedFile;
}
