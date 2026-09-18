import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      audioTrack: true,
      items: { orderBy: { order: "asc" }, include: { mediaAsset: true } },
      renderJobs: { orderBy: { createdAt: "desc" }, include: { outputAsset: true } },
    },
  });
  if (!project) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json(project);
}

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  audioTrackId: z.string().nullable().optional(),
  audioVolume: z.number().min(0).max(2).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const project = await prisma.project.update({ where: { id }, data: parsed.data });
  return NextResponse.json(project);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
