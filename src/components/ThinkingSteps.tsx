import type { ToolStep } from "@/lib/types";

const ICONS: Record<string, string> = {
  buscar_pratos: "🔎",
  buscar_restaurantes: "🏪",
  ver_cardapio: "📋",
  salvar_preferencia: "🧠",
  remover_preferencia: "🧹",
  adicionar_ao_carrinho: "🛒",
  remover_do_carrinho: "➖",
  ver_carrinho: "🧾",
  esvaziar_carrinho: "🗑️",
};

function formatArgs(args: Record<string, unknown>): string {
  const entries = Object.entries(args);
  if (!entries.length) return "";
  return entries.map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`).join(" · ");
}

export default function ThinkingSteps({ steps, live }: { steps: ToolStep[]; live?: boolean }) {
  if (!steps.length) return null;
  return (
    <details open={live} className="group rounded-xl border border-dashed border-line bg-bg/60 px-3 py-2 text-sm">
      <summary className="cursor-pointer select-none text-muted marker:text-accent">
        Como a IA pensou ({steps.length} {steps.length === 1 ? "passo" : "passos"})
      </summary>
      <ol className="mt-2 space-y-1.5">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden>{ICONS[s.name] ?? "⚙️"}</span>
            <div className="min-w-0">
              <p className="text-ink">{s.resumo}</p>
              <p className="break-words font-mono text-[11px] text-muted">
                {s.name}({formatArgs(s.args)})
              </p>
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}
