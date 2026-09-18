import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { musicQueue } from "@/lib/queues";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  lyrics: z.string().max(6000).default(""),
  style: z.string().min(1).max(500),
  voiceGender: z.enum(["MALE", "FEMALE", "INSTRUMENTAL"]),
  instrumental: z.boolean().default(false),
});

export async function GET() {
  const generations = await prisma.musicGeneration.findMany({
    orderBy: { createdAt: "desc" },
    include: { resultAsset: true },
  });
  return NextResponse.json(generations);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const generation = await prisma.musicGeneration.create({
    data: {
      title: data.title,
      lyrics: data.instrumental ? "" : data.lyrics,
      style: data.style,
      voiceGender: data.instrumental ? "INSTRUMENTAL" : data.voiceGender,
      instrumental: data.instrumental,
      provider: process.env.MUSIC_PROVIDER ?? "mock",
      status: "PENDING",
    },
  });

  await musicQueue.add("generate", { musicGenerationId: generation.id });

  return NextResponse.json(generation, { status: 201 });
}
