import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  name: z.string().min(1).max(200),
});

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      audioTrack: true,
      items: true,
      renderJobs: { orderBy: { createdAt: "desc" }, take: 1, include: { outputAsset: true } },
    },
  });
  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const project = await prisma.project.create({ data: { name: parsed.data.name } });
  return NextResponse.json(project, { status: 201 });
}
