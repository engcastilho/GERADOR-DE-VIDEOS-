"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Início" },
  { href: "/musica", label: "Música IA" },
  { href: "/midia", label: "Biblioteca" },
  { href: "/projetos", label: "Projetos" },
  { href: "/lote", label: "Esteira em lote" },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <nav className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 py-3">
        <span className="mr-4 font-semibold whitespace-nowrap">🎬 Gerador de Vídeos IA</span>
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "bg-foreground text-background"
                  : "hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
