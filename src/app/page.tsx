import Link from "next/link";

const cards = [
  {
    href: "/musica",
    title: "🎵 Gerador de música IA",
    description: "Crie faixas com título, letra, estilo e voz (masculina/feminina/instrumental).",
  },
  {
    href: "/midia",
    title: "🖼️ Biblioteca de mídia",
    description: "Envie e organize músicas, imagens e vídeos usados na montagem.",
  },
  {
    href: "/projetos",
    title: "🎬 Editor de projetos",
    description: "Monte a ordem de imagens/vídeos e a trilha sonora, e renderize o vídeo final.",
  },
  {
    href: "/lote",
    title: "🏭 Esteira em lote",
    description: "Gere vários vídeos de uma vez para alimentar seu canal do YouTube.",
  },
];

export default function Home() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Bem-vindo</h1>
        <p className="mt-1 text-black/60 dark:text-white/60">
          Um pipeline completo: gere músicas com IA, organize sua mídia e produza vídeos em lote.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-xl border border-black/10 p-5 transition-colors hover:border-black/30 dark:border-white/15 dark:hover:border-white/30"
          >
            <h2 className="font-medium">{card.title}</h2>
            <p className="mt-1 text-sm text-black/60 dark:text-white/60">{card.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
