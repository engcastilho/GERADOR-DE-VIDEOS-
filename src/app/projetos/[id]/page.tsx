"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";

type MediaAsset = {
  id: string;
  type: "IMAGE" | "VIDEO" | "AUDIO";
  filename: string;
  durationSec: number | null;
};

type TimelineItem = {
  id: string;
  order: number;
  durationSec: number;
  trimStartSec: number;
  transitionIn: "NONE" | "FADE" | "CUT";
  mediaAsset: MediaAsset;
};

type RenderJob = {
  id: string;
  status: "QUEUED" | "RENDERING" | "COMPLETED" | "FAILED";
  progress: number;
  errorMessage: string | null;
  outputAsset: { id: string } | null;
  createdAt: string;
};

type Project = {
  id: string;
  name: string;
  audioTrackId: string | null;
  audioVolume: number;
  audioTrack: MediaAsset | null;
  items: TimelineItem[];
  renderJobs: RenderJob[];
};

type EditableItem = {
  key: string;
  mediaAssetId: string;
  durationSec: number;
  trimStartSec: number;
  transitionIn: "NONE" | "FADE" | "CUT";
  mediaAsset: MediaAsset;
};

const DEFAULT_IMAGE_DURATION = 4;

export default function ProjectEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [project, setProject] = useState<Project | null>(null);
  const [library, setLibrary] = useState<MediaAsset[]>([]);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [audioTrackId, setAudioTrackId] = useState<string | null>(null);
  const [audioVolume, setAudioVolume] = useState(1);
  const [saving, setSaving] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [activeRenderJob, setActiveRenderJob] = useState<RenderJob | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}`);
    if (!res.ok) return;
    const data: Project = await res.json();
    setProject(data);
    setAudioTrackId(data.audioTrackId);
    setAudioVolume(data.audioVolume);
    setItems(
      data.items.map((item) => ({
        key: item.id,
        mediaAssetId: item.mediaAsset.id,
        durationSec: item.durationSec,
        trimStartSec: item.trimStartSec,
        transitionIn: item.transitionIn,
        mediaAsset: item.mediaAsset,
      }))
    );
    if (data.renderJobs[0]) setActiveRenderJob(data.renderJobs[0]);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    loadProject();
  }, [loadProject]);

  useEffect(() => {
    fetch("/api/media")
      .then((res) => res.json())
      .then(setLibrary);
  }, []);

  useEffect(() => {
    const isPolling = activeRenderJob && ["QUEUED", "RENDERING"].includes(activeRenderJob.status);
    if (isPolling && !pollRef.current) {
      pollRef.current = setInterval(async () => {
        const res = await fetch(`/api/render-jobs/${activeRenderJob!.id}`);
        if (res.ok) {
          const job = await res.json();
          setActiveRenderJob(job);
          if (!["QUEUED", "RENDERING"].includes(job.status) && pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      }, 3000);
    }
    return () => {
      if (!isPolling && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [activeRenderJob]);

  function addToTimeline(asset: MediaAsset) {
    setItems((prev) => [
      ...prev,
      {
        key: `${asset.id}-${Date.now()}-${Math.random()}`,
        mediaAssetId: asset.id,
        durationSec: asset.type === "VIDEO" ? asset.durationSec ?? DEFAULT_IMAGE_DURATION : DEFAULT_IMAGE_DURATION,
        trimStartSec: 0,
        transitionIn: "NONE",
        mediaAsset: asset,
      },
    ]);
  }

  function moveItem(index: number, dir: -1 | 1) {
    setItems((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateDuration(index: number, durationSec: number) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, durationSec } : item)));
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioTrackId, audioVolume }),
      });
      await fetch(`/api/projects/${id}/items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            mediaAssetId: item.mediaAssetId,
            durationSec: item.durationSec,
            trimStartSec: item.trimStartSec,
            transitionIn: item.transitionIn,
          })),
        }),
      });
      setMessage("Salvo com sucesso.");
      await loadProject();
    } finally {
      setSaving(false);
    }
  }

  async function handleRender() {
    setRendering(true);
    setMessage(null);
    try {
      await handleSave();
      const res = await fetch(`/api/projects/${id}/render`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setMessage(body?.error ?? "Falha ao iniciar renderização");
        return;
      }
      setActiveRenderJob(body);
    } finally {
      setRendering(false);
    }
  }

  if (!project) return <p>Carregando…</p>;

  const audioAssets = library.filter((a) => a.type === "AUDIO");
  const visualAssets = library.filter((a) => a.type === "IMAGE" || a.type === "VIDEO");
  const totalDuration = items.reduce((sum, item) => sum + item.durationSec, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Duração da timeline: {totalDuration.toFixed(1)}s
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 font-medium">Timeline</h2>
            <div className="space-y-2">
              {items.map((item, index) => (
                <div
                  key={item.key}
                  className="flex items-center gap-3 rounded-lg border border-black/10 p-2 dark:border-white/10"
                >
                  <span className="w-6 text-center text-xs text-black/40">{index + 1}</span>
                  <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded bg-black/5 dark:bg-white/5">
                    {item.mediaAsset.type === "IMAGE" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/media/file/${item.mediaAsset.id}`}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <video src={`/api/media/file/${item.mediaAsset.id}`} className="h-full w-full object-cover" muted />
                    )}
                  </div>
                  <span className="flex-1 truncate text-sm">{item.mediaAsset.filename}</span>
                  <label className="flex items-center gap-1 text-xs">
                    duração
                    <input
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={item.durationSec}
                      onChange={(e) => updateDuration(index, Number(e.target.value))}
                      className="w-16 rounded border border-black/15 bg-transparent px-1 py-0.5 dark:border-white/20"
                    />
                    s
                  </label>
                  <button onClick={() => moveItem(index, -1)} className="px-1 text-sm" title="Mover para cima">
                    ↑
                  </button>
                  <button onClick={() => moveItem(index, 1)} className="px-1 text-sm" title="Mover para baixo">
                    ↓
                  </button>
                  <button onClick={() => removeItem(index)} className="px-1 text-sm text-red-600" title="Remover">
                    ✕
                  </button>
                </div>
              ))}
              {items.length === 0 && (
                <p className="text-sm text-black/50 dark:text-white/50">
                  Adicione imagens/vídeos da biblioteca ao lado.
                </p>
              )}
            </div>
          </section>

          <section className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-full border border-black/15 px-4 py-2 text-sm disabled:opacity-50 dark:border-white/20"
            >
              {saving ? "Salvando…" : "Salvar"}
            </button>
            <button
              onClick={handleRender}
              disabled={rendering || items.length === 0}
              className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
            >
              {rendering ? "Iniciando…" : "Renderizar vídeo"}
            </button>
            {message && <span className="text-sm">{message}</span>}
          </section>

          {activeRenderJob && (
            <section className="rounded-lg border border-black/10 p-4 dark:border-white/10">
              <p className="text-sm font-medium">Status da renderização: {activeRenderJob.status}</p>
              {activeRenderJob.status === "RENDERING" && (
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                  <div
                    className="h-full bg-foreground transition-all"
                    style={{ width: `${activeRenderJob.progress}%` }}
                  />
                </div>
              )}
              {activeRenderJob.status === "FAILED" && (
                <p className="mt-1 text-sm text-red-600">{activeRenderJob.errorMessage}</p>
              )}
              {activeRenderJob.status === "COMPLETED" && activeRenderJob.outputAsset && (
                <div className="mt-2 space-y-2">
                  <video
                    controls
                    className="w-full max-w-xl rounded"
                    src={`/api/media/file/${activeRenderJob.outputAsset.id}`}
                  />
                  <a
                    href={`/api/media/file/${activeRenderJob.outputAsset.id}`}
                    download
                    className="inline-block text-sm underline"
                  >
                    Baixar vídeo
                  </a>
                </div>
              )}
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <section>
            <h2 className="mb-2 font-medium">Trilha sonora</h2>
            <select
              value={audioTrackId ?? ""}
              onChange={(e) => setAudioTrackId(e.target.value || null)}
              className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 dark:border-white/20"
            >
              <option value="">Sem trilha</option>
              {audioAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.filename}
                </option>
              ))}
            </select>
            {audioTrackId && (
              <div className="mt-2">
                <label className="text-xs">Volume: {audioVolume.toFixed(1)}</label>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={audioVolume}
                  onChange={(e) => setAudioVolume(Number(e.target.value))}
                  className="w-full"
                />
                <audio controls className="mt-1 w-full" src={`/api/media/file/${audioTrackId}`} />
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-2 font-medium">Biblioteca (imagens/vídeos)</h2>
            <div className="grid max-h-[600px] grid-cols-2 gap-2 overflow-y-auto">
              {visualAssets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => addToTimeline(asset)}
                  className="overflow-hidden rounded-lg border border-black/10 text-left hover:border-black/30 dark:border-white/10 dark:hover:border-white/30"
                >
                  <div className="flex aspect-video items-center justify-center bg-black/5 dark:bg-white/5">
                    {asset.type === "IMAGE" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/media/file/${asset.id}`}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <video src={`/api/media/file/${asset.id}`} className="h-full w-full object-cover" muted />
                    )}
                  </div>
                  <p className="truncate p-1 text-xs">{asset.filename}</p>
                </button>
              ))}
              {visualAssets.length === 0 && (
                <p className="col-span-2 text-sm text-black/50 dark:text-white/50">
                  Envie imagens/vídeos na Biblioteca.
                </p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
