import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const STORAGE_DIR = process.env.STORAGE_DIR
  ? path.resolve(process.env.STORAGE_DIR)
  : path.resolve(process.cwd(), "storage");

export function storageRoot() {
  return STORAGE_DIR;
}

export function pathForKey(storageKey: string) {
  return path.join(STORAGE_DIR, storageKey);
}

export async function saveBuffer(buffer: Buffer, extension: string) {
  await mkdir(STORAGE_DIR, { recursive: true });
  const storageKey = `${randomUUID()}${extension.startsWith(".") ? extension : `.${extension}`}`;
  await writeFile(pathForKey(storageKey), buffer);
  return storageKey;
}

export async function deleteStoredFile(storageKey: string) {
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
