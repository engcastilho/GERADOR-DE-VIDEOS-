import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const itemSchema = z.object({
  mediaAssetId: z.string(),
  durationSec: z.number().positive(),
  trimStartSec: z.number().min(0).default(0),
  transitionIn: z.enum(["NONE", "FADE", "CUT"]).default("NONE"),
});

const bodySchema = z.object({ items: z.array(itemSchema) });

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.timelineItem.deleteMany({ where: { projectId: id } }),
    prisma.timelineItem.createMany({
      data: parsed.data.items.map((item, index) => ({
        projectId: id,
        order: index,
        mediaAssetId: item.mediaAssetId,
        durationSec: item.durationSec,
        trimStartSec: item.trimStartSec,
        transitionIn: item.transitionIn,
      })),
    }),
  ]);

  const project = await prisma.project.findUnique({
    where: { id },
    include: { items: { orderBy: { order: "asc" }, include: { mediaAsset: true } } },
  });

  return NextResponse.json(project);
}
