import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteStoredFile } from "@/lib/storage";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const asset = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!asset) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  try {
    await prisma.mediaAsset.delete({ where: { id } });
  } catch {
    return NextResponse.json(
      { error: "Não é possível excluir: mídia em uso em um projeto." },
      { status: 409 }
    );
  }

  await deleteStoredFile(asset.storageKey);
  return NextResponse.json({ ok: true });
}
