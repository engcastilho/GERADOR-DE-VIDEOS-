import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const generation = await prisma.musicGeneration.findUnique({
    where: { id },
    include: { resultAsset: true },
  });
  if (!generation) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }
  return NextResponse.json(generation);
}
