import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { put, del } from "@vercel/blob";

const STORAGE_DIR = process.env.STORAGE_DIR
  ? path.resolve(process.env.STORAGE_DIR)
  : path.resolve(process.cwd(), "storage");

/**
 * Two storage backends behind one `storageKey` string on MediaAsset:
 * - local disk (dev): storageKey is a filename under STORAGE_DIR.
 * - Vercel Blob (production on Vercel, whose filesystem is read-only and
 *   ephemeral): storageKey is the blob's public https URL.
 * Callers don't need to know which one is active — `isRemoteUrl` tells the
 * file-serving route whether to stream from disk or redirect.
 */
function isBlobEnabled() {
  return process.env.STORAGE_DRIVER === "blob" || !!process.env.BLOB_READ_WRITE_TOKEN;
}

export function isRemoteUrl(storageKey: string) {
  return storageKey.startsWith("http://") || storageKey.startsWith("https://");
}

export function pathForKey(storageKey: string) {
  return path.join(STORAGE_DIR, storageKey);
}

export async function saveBuffer(buffer: Buffer, extension: string) {
  const filename = `${randomUUID()}${extension.startsWith(".") ? extension : `.${extension}`}`;

  if (isBlobEnabled()) {
    const blob = await put(filename, buffer, { access: "public", addRandomSuffix: false });
    return blob.url;
  }

  await mkdir(STORAGE_DIR, { recursive: true });
  await writeFile(pathForKey(filename), buffer);
  return filename;
}

export async function deleteStoredFile(storageKey: string) {
  if (isRemoteUrl(storageKey)) {
    await del(storageKey).catch(() => {});
    return;
  }
  try {
    await unlink(pathForKey(storageKey));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

export function extensionFromMime(mimeType: string) {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/webm": ".webm",
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/mp4": ".m4a",
    "audio/ogg": ".ogg",
  };
  return map[mimeType] ?? "";
}
