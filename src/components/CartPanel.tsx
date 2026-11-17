import { cartTotals, formatBRL } from "@/lib/cart";
import type { AgentState, Preferences } from "@/lib/types";
import { TAG_LABELS } from "./TagChips";

interface Props {
  state: AgentState;
  notice?: string;
  onRemoveItem: (itemId: string) => void;
  onRemovePref: (key: keyof Preferences, value: string) => void;
  onCheckout: () => void;
}

export default function CartPanel({ state, notice, onRemoveItem, onRemovePref, onCheckout }: Props) {
  const { cart, prefs } = state;
  const totals = cartTotals(cart);
  const prefChips: { key: keyof Preferences; value: string; label: string }[] = [
    ...prefs.dieta.map((v) => ({ key: "dieta" as const, value: v, label: v })),
    ...prefs.evitar.map((v) => ({ key: "evitar" as const, value: v, label: `sem ${v}` })),
    ...prefs.gostos.map((v) => ({ key: "gostos" as const, value: v, label: `curte ${v}` })),
  ];

  return (
    <section aria-label="Seu pedido" className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">O que a IA lembra de você</h2>
        {prefChips.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {prefChips.map((p) => (
              <li key={`${p.key}-${p.value}`} className="flex items-center gap-1 rounded-full bg-accent/10 py-1 pl-3 pr-1 text-sm text-ink">
                <span>{p.key === "dieta" ? TAG_LABELS[p.value as keyof typeof TAG_LABELS]?.split(" ")[0] : "🚫"}</span>
                <span>{p.label}</span>
                <button
                  type="button"
                  onClick={() => onRemovePref(p.key, p.value)}
                  aria-label={`Remover preferência ${p.value}`}
                  className="grid h-5 w-5 place-items-center rounded-full text-muted hover:bg-accent/20 hover:text-ink"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Nada ainda. Conte suas restrições (ex.: &quot;sou vegano&quot;) que eu lembro.</p>
        )}
      </div>

      <div className="flex flex-1 flex-col">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Carrinho</h2>
        {cart.itens.length === 0 ? (
          <p className="text-sm text-muted">Seu carrinho está vazio.</p>
        ) : (
          <div className="flex flex-col gap-3 rounded-xl border border-line bg-card p-3">
            <p className="text-sm font-medium text-ink">{cart.restauranteNome}</p>
            <ul className="flex flex-col gap-2">
              {cart.itens.map((i) => (
                <li key={i.itemId} className="flex items-start gap-2 text-sm">
                  <span className="font-semibold text-accent">{`${i.quantidade}×`}</span>
                  <span className="flex-1 text-ink">
                    {i.nome}
                    {i.observacao && <span className="block text-xs text-muted">{i.observacao}</span>}
                  </span>
                  <span className="text-ink">{formatBRL(i.preco * i.quantidade)}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveItem(i.itemId)}
                    aria-label={`Remover ${i.nome}`}
                    className="text-muted hover:text-danger"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <dl className="space-y-1 border-t border-line pt-2 text-sm">
              <div className="flex justify-between text-muted">
                <dt>Subtotal</dt>
                <dd>{formatBRL(totals.subtotal)}</dd>
              </div>
              <div className="flex justify-between text-muted">
                <dt>Entrega</dt>
                <dd>{totals.taxa ? formatBRL(totals.taxa) : "grátis"}</dd>
              </div>
              <div className="flex justify-between font-semibold text-ink">
                <dt>Total</dt>
                <dd>{formatBRL(totals.total)}</dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={onCheckout}
              className="rounded-full bg-accent py-2 font-medium text-accent-ink transition hover:brightness-110"
            >
              Finalizar pedido
            </button>
          </div>
        )}
        {notice && (
          <p role="status" className="mt-3 rounded-xl bg-accent/10 p-3 text-sm text-ink">
            {notice}
          </p>
        )}
      </div>
    </section>
  );
}
