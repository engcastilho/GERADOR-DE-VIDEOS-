"use client";

import { useEffect, useRef, useState } from "react";

type VoiceGender = "MALE" | "FEMALE" | "INSTRUMENTAL";

type MusicGeneration = {
  id: string;
  title: string;
  lyrics: string;
  style: string;
  voiceGender: VoiceGender;
  instrumental: boolean;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  errorMessage: string | null;
  createdAt: string;
  resultAsset: { id: string; durationSec: number | null } | null;
};

const statusLabel: Record<MusicGeneration["status"], string> = {
  PENDING: "Na fila",
  PROCESSING: "Gerando…",
  COMPLETED: "Pronta",
  FAILED: "Falhou",
};

const statusColor: Record<MusicGeneration["status"], string> = {
  PENDING: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  PROCESSING: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  COMPLETED: "bg-green-500/15 text-green-700 dark:text-green-400",
  FAILED: "bg-red-500/15 text-red-700 dark:text-red-400",
};

export default function MusicaPage() {
  const [title, setTitle] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [style, setStyle] = useState("");
  const [voiceGender, setVoiceGender] = useState<VoiceGender>("FEMALE");
  const [instrumental, setInstrumental] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generations, setGenerations] = useState<MusicGeneration[]>([]);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadGenerations() {
    const res = await fetch("/api/music");
    if (res.ok) {
      setGenerations(await res.json());
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    loadGenerations();
    pollingRef.current = setInterval(loadGenerations, 4000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, lyrics, style, voiceGender, instrumental }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ? JSON.stringify(body.error) : "Falha ao criar geração");
      }
      setTitle("");
      setLyrics("");
      setStyle("");
      await loadGenerations();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Gerador de música com IA</h1>
        <p className="mt-1 text-black/60 dark:text-white/60">
          Defina título, letra, estilo e a voz — o provedor configurado (variável{" "}
          <code>MUSIC_PROVIDER</code>) faz a geração em segundo plano.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid max-w-2xl gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Título</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 dark:border-white/20"
            placeholder="Ex: Luz do Amanhecer"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Estilo / gênero</label>
          <input
            required
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 dark:border-white/20"
            placeholder="Ex: pop acústico, sertanejo, lofi hip-hop"
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">Voz</label>
          <div className="flex gap-2">
            {(["FEMALE", "MALE", "INSTRUMENTAL"] as VoiceGender[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setVoiceGender(option);
                  setInstrumental(option === "INSTRUMENTAL");
                }}
                className={`rounded-full px-3 py-1.5 text-sm border ${
                  voiceGender === option
                    ? "border-foreground bg-foreground text-background"
                    : "border-black/15 dark:border-white/20"
                }`}
              >
                {option === "FEMALE" ? "Feminina" : option === "MALE" ? "Masculina" : "Instrumental"}
              </button>
            ))}
          </div>
        </div>

        {!instrumental && (
          <div>
            <label className="mb-1 block text-sm font-medium">Letra</label>
            <textarea
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 font-mono text-sm dark:border-white/20"
              placeholder={"[Verso 1]\n...\n\n[Refrão]\n..."}
            />
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-fit rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {submitting ? "Enviando…" : "Gerar música"}
        </button>
      </form>

      <div>
        <h2 className="mb-3 text-lg font-medium">Suas gerações</h2>
        <div className="space-y-3">
          {generations.length === 0 && (
            <p className="text-sm text-black/50 dark:text-white/50">Nenhuma geração ainda.</p>
          )}
          {generations.map((gen) => (
            <div
              key={gen.id}
              className="flex flex-col gap-2 rounded-lg border border-black/10 p-4 dark:border-white/10"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-medium">{gen.title}</span>
                  <span className="ml-2 text-sm text-black/50 dark:text-white/50">{gen.style}</span>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusColor[gen.status]}`}>
                  {statusLabel[gen.status]}
                </span>
              </div>
              {gen.status === "FAILED" && gen.errorMessage && (
                <p className="text-xs text-red-600">{gen.errorMessage}</p>
              )}
              {gen.status === "COMPLETED" && gen.resultAsset && (
                <audio controls className="w-full" src={`/api/media/file/${gen.resultAsset.id}`} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
