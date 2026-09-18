import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { readFile, unlink } from "fs/promises";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { prisma } from "@/lib/prisma";
import { saveBuffer } from "@/lib/storage";
import { resolveBrowserExecutable } from "./browser-executable";
import type { TimelineCompositionProps } from "@/remotion/TimelineComposition";

const FPS = 30;

function appBaseUrl() {
  return process.env.APP_BASE_URL ?? "http://localhost:3000";
}

let bundleLocationPromise: Promise<string> | null = null;
function getBundleLocation() {
  if (!bundleLocationPromise) {
    bundleLocationPromise = bundle({
      entryPoint: path.join(process.cwd(), "src/remotion/index.ts"),
    });
  }
  return bundleLocationPromise;
}

export async function runRender(renderJobId: string) {
  const job = await prisma.renderJob.findUnique({ where: { id: renderJobId } });
  if (!job) return;

  try {
    await prisma.renderJob.update({
      where: { id: renderJobId },
      data: { status: "RENDERING", progress: 0 },
    });

    const project = await prisma.project.findUnique({
      where: { id: job.projectId },
      include: {
        items: { orderBy: { order: "asc" }, include: { mediaAsset: true } },
        audioTrack: true,
      },
    });
    if (!project) throw new Error("Projeto não encontrado");
    if (project.items.length === 0) throw new Error("A timeline do projeto está vazia");

    const inputProps: TimelineCompositionProps = {
      items: project.items.map((item) => ({
        mediaUrl: `${appBaseUrl()}/api/media/file/${item.mediaAsset.id}`,
        type: item.mediaAsset.type === "VIDEO" ? "VIDEO" : "IMAGE",
        durationInFrames: Math.max(1, Math.round(item.durationSec * FPS)),
        trimStartSec: item.trimStartSec,
      })),
      audioUrl: project.audioTrack
        ? `${appBaseUrl()}/api/media/file/${project.audioTrack.id}`
        : undefined,
      audioVolume: project.audioVolume,
      fps: FPS,
    };

    const browserExecutable = resolveBrowserExecutable();
    const serveUrl = await getBundleLocation();

    const composition = await selectComposition({
      serveUrl,
      id: "Timeline",
      inputProps,
      browserExecutable,
    });

    const outputPath = path.join(os.tmpdir(), `render-${randomUUID()}.mp4`);

    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: outputPath,
      inputProps,
      browserExecutable,
      onProgress: ({ progress }) => {
        prisma.renderJob
          .update({ where: { id: renderJobId }, data: { progress: Math.round(progress * 100) } })
          .catch(() => {});
      },
    });

    const buffer = await readFile(outputPath);
    const storageKey = await saveBuffer(buffer, ".mp4");
    await unlink(outputPath).catch(() => {});

    const outputAsset = await prisma.mediaAsset.create({
      data: {
        type: "VIDEO",
        source: "GENERATED_VIDEO",
        filename: `${project.name}.mp4`,
        storageKey,
        mimeType: "video/mp4",
        sizeBytes: buffer.length,
        durationSec: composition.durationInFrames / composition.fps,
        width: composition.width,
        height: composition.height,
      },
    });

    await prisma.renderJob.update({
      where: { id: renderJobId },
      data: { status: "COMPLETED", progress: 100, outputAssetId: outputAsset.id },
    });
  } catch (err) {
    await prisma.renderJob.update({
      where: { id: renderJobId },
      data: {
        status: "FAILED",
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
  }
}
