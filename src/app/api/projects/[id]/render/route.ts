import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { renderQueue } from "@/lib/queues";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 });
  }
  if (project.items.length === 0) {
    return NextResponse.json(
      { error: "Adicione ao menos um item à timeline antes de renderizar." },
      { status: 400 }
    );
  }

  const renderJob = await prisma.renderJob.create({
    data: { projectId: id, status: "QUEUED" },
  });

  await renderQueue.add("render", { renderJobId: renderJob.id });

  return NextResponse.json(renderJob, { status: 201 });
}
