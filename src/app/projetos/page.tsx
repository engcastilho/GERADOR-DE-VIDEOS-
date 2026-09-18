"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type RenderStatus = "QUEUED" | "RENDERING" | "COMPLETED" | "FAILED";

type Project = {
  id: string;
  name: string;
  items: { id: string }[];
  audioTrack: { id: string } | null;
  renderJobs: { status: RenderStatus }[];
  createdAt: string;
};

const statusColor: Record<RenderStatus, string> = {
  QUEUED: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  RENDERING: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  COMPLETED: "bg-green-500/15 text-green-700 dark:text-green-400",
  FAILED: "bg-red-500/15 text-red-700 dark:text-red-400",
};

export default function ProjetosPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    const res = await fetch("/api/projects");
    if (res.ok) setProjects(await res.json());
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setCreating(false);
    if (res.ok) {
      const project = await res.json();
      router.push(`/projetos/${project.id}`);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Projetos de vídeo</h1>
        <p className="mt-1 text-black/60 dark:text-white/60">
          Monte a timeline com imagens, vídeos e uma trilha sonora, e renderize o vídeo final.
        </p>
      </div>

      <form onSubmit={handleCreate} className="flex max-w-md gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do novo projeto"
          className="flex-1 rounded-lg border border-black/15 bg-transparent px-3 py-2 dark:border-white/20"
        />
        <button
          type="submit"
          disabled={creating}
          className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          Criar
        </button>
      </form>

      <div className="space-y-3">
        {projects.map((project) => {
          const latestRender = project.renderJobs[0];
          return (
            <Link
              key={project.id}
              href={`/projetos/${project.id}`}
              className="flex items-center justify-between rounded-lg border border-black/10 p-4 hover:border-black/30 dark:border-white/10 dark:hover:border-white/30"
            >
              <div>
                <p className="font-medium">{project.name}</p>
                <p className="text-xs text-black/50 dark:text-white/50">
                  {project.items.length} item(ns) · {project.audioTrack ? "com trilha" : "sem trilha"}
                </p>
              </div>
              {latestRender && (
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusColor[latestRender.status]}`}>
                  {latestRender.status}
                </span>
              )}
            </Link>
          );
        })}
        {projects.length === 0 && (
          <p className="text-sm text-black/50 dark:text-white/50">Nenhum projeto ainda.</p>
        )}
      </div>
    </div>
  );
}
