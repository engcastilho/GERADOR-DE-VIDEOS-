import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const batchJob = await prisma.batchJob.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { index: "asc" },
        include: {
          musicGeneration: { include: { resultAsset: true } },
          project: {
            include: {
              renderJobs: { orderBy: { createdAt: "desc" }, take: 1, include: { outputAsset: true } },
            },
          },
        },
      },
    },
  });
  if (!batchJob) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json(batchJob);
}
