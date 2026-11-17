import { formatBRL } from "@/lib/cart";
import type { DishResult } from "@/lib/types";
import TagChips from "./TagChips";

export default function DishCard({ dish, onAdd }: { dish: DishResult; onAdd: (dish: DishResult) => void }) {
  const r = dish.restaurante;
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-line bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold leading-snug text-ink">{dish.nome}</p>
        <p className="shrink-0 font-semibold text-accent">{formatBRL(dish.preco)}</p>
      </div>
      <p className="line-clamp-2 text-sm text-muted">{dish.descricao}</p>
      <TagChips tags={dish.tags} />
      <div className="mt-auto flex items-end justify-between gap-2 pt-1">
        <div className="text-xs text-muted">
          <p className="font-medium text-ink">{`${r.nome} · ${r.bairro}`}</p>
          <p>
            {r.nota > 0 && <>★ {r.nota.toFixed(1)} · </>}
            {r.tempoEntregaMin} min · entrega {r.taxaEntrega ? formatBRL(r.taxaEntrega) : "grátis"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onAdd(dish)}
          aria-label={`Adicionar ${dish.nome}`}
          className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink transition hover:brightness-110"
        >
          + Adicionar
        </button>
      </div>
    </li>
  );
}
