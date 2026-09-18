import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createBatchJob } from "@/lib/batch/orchestrate";

const specSchema = z.object({
  title: z.string().min(1).max(200),
  lyrics: z.string().max(6000).default(""),
  style: z.string().min(1).max(500),
  voiceGender: z.enum(["MALE", "FEMALE", "INSTRUMENTAL"]),
  instrumental: z.boolean().default(false),
});

const createSchema = z.object({
  name: z.string().min(1).max(200),
  specs: z.array(specSchema).min(1).max(50),
  mediaAssetIds: z.array(z.string()).min(1),
  secondsPerImage: z.number().min(1).max(60).default(4),
  shuffle: z.boolean().default(true),
});

export async function GET() {
  const batchJobs = await prisma.batchJob.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        orderBy: { index: "asc" },
        include: {
          musicGeneration: true,
          project: { include: { renderJobs: { orderBy: { createdAt: "desc" }, take: 1, include: { outputAsset: true } } } },
        },
      },
    },
  });
  return NextResponse.json(batchJobs);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const batchJob = await createBatchJob({
    name: data.name,
    specs: data.specs.map((spec) => ({
      title: spec.title,
      lyrics: spec.instrumental ? "" : spec.lyrics,
      style: spec.style,
      voiceGender: spec.instrumental ? "INSTRUMENTAL" : spec.voiceGender,
      instrumental: spec.instrumental,
    })),
    mediaAssetIds: data.mediaAssetIds,
    secondsPerImage: data.secondsPerImage,
    shuffle: data.shuffle,
  });

  return NextResponse.json(batchJob, { status: 201 });
}
