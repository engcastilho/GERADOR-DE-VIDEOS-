import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { prisma } from "@/lib/prisma";
import { extensionFromMime, saveBuffer } from "@/lib/storage";
import { probeBuffer } from "@/lib/media-probe";
import { MediaType } from "@prisma/client";

function typeFromMime(mimeType: string): MediaType | null {
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType.startsWith("video/")) return "VIDEO";
  if (mimeType.startsWith("audio/")) return "AUDIO";
  return null;
}

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") as MediaType | null;
  const assets = await prisma.mediaAsset.findMany({
    where: type ? { type } : undefined,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(assets);
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const files = formData.getAll("file") as File[];

  if (files.length === 0) {
    return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
  }

  const created = [];

  for (const file of files) {
    const mimeType = file.type || "application/octet-stream";
    const type = typeFromMime(mimeType);
    if (!type) {
      continue;
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const extension = extensionFromMime(mimeType) || path.extname(file.name);
    const probe = await probeBuffer(buffer, extension);
    const storageKey = await saveBuffer(buffer, extension);

    const asset = await prisma.mediaAsset.create({
      data: {
        type,
        source: "UPLOAD",
        filename: file.name,
        storageKey,
        mimeType,
        sizeBytes: buffer.length,
        durationSec: type === "IMAGE" ? null : probe.durationSec,
        width: probe.width,
        height: probe.height,
      },
    });
    created.push(asset);
  }

  return NextResponse.json(created, { status: 201 });
}
