"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const LINKS = [
  { href: "/", label: "Pedir comida" },
  { href: "/restaurante", label: "Para restaurantes" },
];

export default function AppHeader({ action }: { action?: ReactNode }) {
  const pathname = usePathname();
  return (
    <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
      <Link href="/" className="flex items-center gap-2">
        <span className="text-2xl" aria-hidden>
          🍽️
        </span>
        <span className="hidden sm:block">
          <span className="block font-semibold leading-tight text-ink">Garfada</span>
          <span className="block text-xs text-muted">Pedidos por conversa, com IA</span>
        </span>
      </Link>
      <nav aria-label="Principal" className="flex items-center gap-1 rounded-full border border-line bg-card p-1 text-sm">
        {LINKS.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-full px-3 py-1.5 transition ${active ? "bg-accent text-accent-ink" : "text-muted hover:text-ink"}`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
      {action ?? <span className="w-10" />}
    </header>
  );
}
