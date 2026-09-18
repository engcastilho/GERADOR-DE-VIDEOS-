"use client";

import { useEffect, useRef, useState } from "react";

type VoiceGender = "MALE" | "FEMALE" | "INSTRUMENTAL";

type MusicSpec = {
  key: string;
  title: string;
  lyrics: string;
  style: string;
  voiceGender: VoiceGender;
  instrumental: boolean;
};

type MediaAsset = {
  id: string;
  type: "IMAGE" | "VIDEO" | "AUDIO";
  filename: string;
};

type RenderStatus = "QUEUED" | "RENDERING" | "COMPLETED" | "FAILED";
type GenerationStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

type BatchItem = {
  id: string;
  index: number;
  status: GenerationStatus;
  errorMessage: string | null;
  musicGeneration: { title: string; status: GenerationStatus } | null;
  project: {
    id: string;
    renderJobs: { status: RenderStatus; outputAsset: { id: string } | null }[];
  } | null;
};

type BatchJob = {
  id: string;
  name: string;
  createdAt: string;
  items: BatchItem[];
};

function emptySpec(): MusicSpec {
  return {
    key: crypto.randomUUID(),
    title: "",
    lyrics: "",
    style: "",
    voiceGender: "FEMALE",
    instrumental: false,
  };
}

export default function LotePage() {
  const [name, setName] = useState("");
  const [specs, setSpecs] = useState<MusicSpec[]>([emptySpec()]);
  const [library, setLibrary] = useState<MediaAsset[]>([]);
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [secondsPerImage, setSecondsPerImage] = useState(4);
  const [shuffle, setShuffle] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchJobs, setBatchJobs] = useState<BatchJob[]>([]);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadLibrary() {
    const res = await fetch("/api/media");
    if (res.ok) setLibrary((await res.json()).filter((a: MediaAsset) => a.type !== "AUDIO"));
  }

  async function loadBatchJobs() {
    const res = await fetch("/api/batch");
    if (res.ok) setBatchJobs(await res.json());
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    loadLibrary();
    loadBatchJobs();
    pollRef.current = setInterval(loadBatchJobs, 4000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function updateSpec(key: string, patch: Partial<MusicSpec>) {
    setSpecs((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  function addSpec() {
    setSpecs((prev) => [...prev, emptySpec()]);
  }

  function duplicateSpec(key: string) {
    setSpecs((prev) => {
      const source = prev.find((s) => s.key === key);
      if (!source) return prev;
      const index = prev.indexOf(source);
      const copy = { ...source, key: crypto.randomUUID(), title: `${source.title} (2)` };
      return [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)];
    });
  }

  function removeSpec(key: string) {
    setSpecs((prev) => (prev.length > 1 ? prev.filter((s) => s.key !== key) : prev));
  }

  function toggleMedia(id: string) {
    setSelectedMediaIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (selectedMediaIds.length === 0) {
      setError("Selecione ao menos uma imagem ou vídeo para o pool de mídia.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          specs: specs.map(({ title, lyrics, style, voiceGender, instrumental }) => ({
            title,
            lyrics,
            style,
            voiceGender,
            instrumental,
          })),
          mediaAssetIds: selectedMediaIds,
          secondsPerImage,
          shuffle,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ? JSON.stringify(body.error) : "Falha ao criar lote");
      }
      setName("");
      setSpecs([emptySpec()]);
      setSelectedMediaIds([]);
      await loadBatchJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Esteira de produção em lote</h1>
        <p className="mt-1 text-black/60 dark:text-white/60">
          Gere várias músicas de uma vez e monte automaticamente um vídeo para cada uma, usando um
          pool de imagens/vídeos compartilhado — ideal para alimentar seu canal do YouTube.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="max-w-md">
          <label className="mb-1 block text-sm font-medium">Nome do lote</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 dark:border-white/20"
            placeholder="Ex: Lote motivacional #1"
          />
        </div>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-medium">Músicas do lote ({specs.length})</h2>
            <button type="button" onClick={addSpec} className="text-sm underline">
              + adicionar música
            </button>
          </div>
          <div className="space-y-3">
            {specs.map((spec, i) => (
              <div key={spec.key} className="space-y-2 rounded-lg border border-black/10 p-3 dark:border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-black/50 dark:text-white/50">Vídeo #{i + 1}</span>
                  <div className="flex gap-3 text-xs">
                    <button type="button" onClick={() => duplicateSpec(spec.key)} className="underline">
                      duplicar
                    </button>
                    <button type="button" onClick={() => removeSpec(spec.key)} className="text-red-600 underline">
                      remover
                    </button>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    required
                    placeholder="Título"
                    value={spec.title}
                    onChange={(e) => updateSpec(spec.key, { title: e.target.value })}
                    className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20"
                  />
                  <input
                    required
                    placeholder="Estilo (ex: lofi hip-hop)"
                    value={spec.style}
                    onChange={(e) => updateSpec(spec.key, { style: e.target.value })}
                    className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20"
                  />
                </div>
                <div className="flex gap-2">
                  {(["FEMALE", "MALE", "INSTRUMENTAL"] as VoiceGender[]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() =>
                        updateSpec(spec.key, {
                          voiceGender: option,
                          instrumental: option === "INSTRUMENTAL",
                        })
                      }
                      className={`rounded-full px-2.5 py-1 text-xs border ${
                        spec.voiceGender === option
                          ? "border-foreground bg-foreground text-background"
                          : "border-black/15 dark:border-white/20"
                      }`}
                    >
                      {option === "FEMALE" ? "Feminina" : option === "MALE" ? "Masculina" : "Instrumental"}
                    </button>
                  ))}
                </div>
                {!spec.instrumental && (
                  <textarea
                    placeholder="Letra"
                    value={spec.lyrics}
                    onChange={(e) => updateSpec(spec.key, { lyrics: e.target.value })}
                    rows={3}
                    className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 font-mono text-xs dark:border-white/20"
                  />
                )}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 font-medium">Pool de imagens/vídeos compartilhado</h2>
          <div className="mb-2 flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              Segundos por imagem
              <input
                type="number"
                min={1}
                max={60}
                value={secondsPerImage}
                onChange={(e) => setSecondsPerImage(Number(e.target.value))}
                className="w-16 rounded border border-black/15 bg-transparent px-2 py-1 dark:border-white/20"
              />
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} />
              Embaralhar ordem em cada vídeo
            </label>
          </div>
          <div className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 md:grid-cols-6">
            {library.map((asset) => (
              <button
                type="button"
                key={asset.id}
                onClick={() => toggleMedia(asset.id)}
                className={`overflow-hidden rounded-lg border-2 text-left ${
                  selectedMediaIds.includes(asset.id)
                    ? "border-foreground"
                    : "border-transparent"
                }`}
              >
                <div className="flex aspect-video items-center justify-center bg-black/5 dark:bg-white/5">
                  {asset.type === "IMAGE" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/media/file/${asset.id}`} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <video src={`/api/media/file/${asset.id}`} className="h-full w-full object-cover" muted />
                  )}
                </div>
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-black/50 dark:text-white/50">
            {selectedMediaIds.length} selecionado(s)
          </p>
        </section>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {submitting ? "Enviando…" : `Gerar ${specs.length} vídeo(s)`}
        </button>
      </form>

      <section>
        <h2 className="mb-3 text-lg font-medium">Lotes</h2>
        <div className="space-y-4">
          {batchJobs.map((batch) => (
            <div key={batch.id} className="rounded-lg border border-black/10 p-4 dark:border-white/10">
              <p className="mb-2 font-medium">{batch.name}</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-black/50 dark:text-white/50">
                    <th className="pb-1">#</th>
                    <th className="pb-1">Título</th>
                    <th className="pb-1">Música</th>
                    <th className="pb-1">Vídeo</th>
                    <th className="pb-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {batch.items.map((item) => {
                    const renderJob = item.project?.renderJobs[0];
                    return (
                      <tr key={item.id} className="border-t border-black/5 dark:border-white/10">
                        <td className="py-1.5">{item.index + 1}</td>
                        <td className="py-1.5">{item.musicGeneration?.title ?? "-"}</td>
                        <td className="py-1.5">{item.musicGeneration?.status ?? item.status}</td>
                        <td className="py-1.5">{renderJob?.status ?? "-"}</td>
                        <td className="py-1.5">
                          {renderJob?.status === "COMPLETED" && renderJob.outputAsset && (
                            <a
                              href={`/api/media/file/${renderJob.outputAsset.id}`}
                              download
                              className="text-xs underline"
                            >
                              baixar
                            </a>
                          )}
                          {item.status === "FAILED" && (
                            <span className="text-xs text-red-600" title={item.errorMessage ?? ""}>
                              erro
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
          {batchJobs.length === 0 && (
            <p className="text-sm text-black/50 dark:text-white/50">Nenhum lote criado ainda.</p>
          )}
        </div>
      </section>
    </div>
  );
}
