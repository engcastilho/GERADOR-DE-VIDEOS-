"use client";

import { useEffect, useRef, useState } from "react";

type MediaType = "IMAGE" | "VIDEO" | "AUDIO";

type MediaAsset = {
  id: string;
  type: MediaType;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  createdAt: string;
};

const typeLabel: Record<MediaType, string> = {
  IMAGE: "Imagem",
  VIDEO: "Vídeo",
  AUDIO: "Áudio",
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(sec: number | null) {
  if (!sec) return null;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function MidiaPage() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [filter, setFilter] = useState<MediaType | "ALL">("ALL");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadAssets() {
    const res = await fetch("/api/media");
    if (res.ok) setAssets(await res.json());
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    loadAssets();
  }, []);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("file", file));
      const res = await fetch("/api/media", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Falha no upload");
      }
      await loadAssets();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este arquivo da biblioteca?")) return;
    const res = await fetch(`/api/media/${id}`, { method: "DELETE" });
    if (res.ok) {
      setAssets((prev) => prev.filter((a) => a.id !== id));
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body?.error ?? "Falha ao excluir");
    }
  }

  const filtered = filter === "ALL" ? assets : assets.filter((a) => a.type === filter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Biblioteca de mídia</h1>
        <p className="mt-1 text-black/60 dark:text-white/60">
          Envie imagens, vídeos e áudios para usar na montagem dos seus vídeos.
        </p>
      </div>

      <div
        className="rounded-xl border-2 border-dashed border-black/15 p-8 text-center dark:border-white/20"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleUpload(e.dataTransfer.files);
        }}
      >
        <p className="mb-3 text-sm text-black/60 dark:text-white/60">
          Arraste arquivos aqui ou clique para selecionar (imagens, vídeos, áudios)
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,audio/*"
          onChange={(e) => handleUpload(e.target.files)}
          className="mx-auto block text-sm"
        />
        {uploading && <p className="mt-2 text-sm">Enviando…</p>}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      <div className="flex gap-2">
        {(["ALL", "IMAGE", "VIDEO", "AUDIO"] as const).map((option) => (
          <button
            key={option}
            onClick={() => setFilter(option)}
            className={`rounded-full px-3 py-1.5 text-sm border ${
              filter === option
                ? "border-foreground bg-foreground text-background"
                : "border-black/15 dark:border-white/20"
            }`}
          >
            {option === "ALL" ? "Todos" : typeLabel[option]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map((asset) => (
          <div
            key={asset.id}
            className="overflow-hidden rounded-lg border border-black/10 dark:border-white/10"
          >
            <div className="flex aspect-video items-center justify-center bg-black/5 dark:bg-white/5">
              {asset.type === "IMAGE" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/media/file/${asset.id}`}
                  alt={asset.filename}
                  className="h-full w-full object-cover"
                />
              )}
              {asset.type === "VIDEO" && (
                <video src={`/api/media/file/${asset.id}`} className="h-full w-full object-cover" muted />
              )}
              {asset.type === "AUDIO" && <span className="text-3xl">🎵</span>}
            </div>
            <div className="space-y-1 p-3">
              <p className="truncate text-sm font-medium" title={asset.filename}>
                {asset.filename}
              </p>
              <p className="text-xs text-black/50 dark:text-white/50">
                {formatBytes(asset.sizeBytes)}
                {formatDuration(asset.durationSec) ? ` · ${formatDuration(asset.durationSec)}` : ""}
                {asset.width ? ` · ${asset.width}×${asset.height}` : ""}
              </p>
              {asset.type === "AUDIO" && (
                <audio controls className="w-full" src={`/api/media/file/${asset.id}`} />
              )}
              <button
                onClick={() => handleDelete(asset.id)}
                className="text-xs text-red-600 hover:underline"
              >
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-black/50 dark:text-white/50">Nenhum arquivo encontrado.</p>
      )}
    </div>
  );
}
