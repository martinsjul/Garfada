"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CATALOG } from "@/data/catalog";
import { useAgentChat } from "@/hooks/useAgentChat";
import { useImportedRestaurants } from "@/hooks/useImportedRestaurants";
import { addToCart, cartTotals, formatBRL, removeFromCart } from "@/lib/cart";
import { findItem, violatesPrefs } from "@/lib/catalog/search";
import { EMPTY_CART, type DishResult, type Preferences } from "@/lib/types";
import AppHeader from "./AppHeader";
import CartPanel from "./CartPanel";
import ChatInput from "./ChatInput";
import MessageBubble from "./MessageBubble";
import Suggestions from "./Suggestions";

export default function Chat() {
  const { restaurants: imported } = useImportedRestaurants();
  const { messages, send, loading, agentState, setAgentState } = useAgentChat(imported);
  const [notice, setNotice] = useState<string>();
  const [cartOpen, setCartOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const catalog = useMemo(() => [...CATALOG, ...imported], [imported]);
  const count = cartTotals(agentState.cart).quantidade;

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [messages]);

  const addDish = useCallback(
    (dish: DishResult) => {
      const found = findItem(catalog, dish.itemId);
      if (!found || loading) return;
      let error: string | undefined;
      setAgentState((s) => {
        if (violatesPrefs(found.item, s.prefs)) {
          error = `"${found.item.nome}" não combina com uma restrição sua. Remova a preferência se quiser pedir mesmo assim.`;
          return s;
        }
        const res = addToCart(s.cart, found.restaurant, found.item, 1);
        if (!res.ok) {
          error = res.error;
          return s;
        }
        return { ...s, cart: res.cart };
      });
      setNotice(error);
      if (error) setCartOpen(true);
    },
    [catalog, loading, setAgentState],
  );

  const removePref = (key: keyof Preferences, value: string) =>
    setAgentState((s) => ({ ...s, prefs: { ...s.prefs, [key]: (s.prefs[key] as string[]).filter((v) => v !== value) } }));

  const checkout = () => {
    const { total } = cartTotals(agentState.cart);
    setNotice(`Pedido simulado enviado! 🎉 Total de ${formatBRL(total)} para ${agentState.cart.restauranteNome}. Nenhum pagamento foi feito.`);
    setAgentState((s) => ({ ...s, cart: EMPTY_CART }));
  };

  const extraSuggestions = imported.slice(0, 1).map((r) => `O que tem de bom no ${r.nome}?`);

  return (
    <div className="flex h-dvh flex-col">
      <AppHeader
        action={
          <button
            type="button"
            onClick={() => setCartOpen((o) => !o)}
            aria-label={`Carrinho com ${count} ${count === 1 ? "item" : "itens"}`}
            aria-expanded={cartOpen}
            className="relative grid h-10 w-10 place-items-center rounded-full border border-line bg-card lg:hidden"
          >
            <span aria-hidden>🛒</span>
            {count > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-ink">
                {count}
              </span>
            )}
          </button>
        }
      />

      <div className="flex min-h-0 flex-1">
        <div className="mx-auto flex min-w-0 max-w-3xl flex-1 flex-col">
          <main className="flex-1 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <Suggestions onPick={send} extra={extraSuggestions} />
            ) : (
              <div className="flex flex-col gap-4">
                {messages.map((m, i) => (
                  <MessageBubble key={i} message={m} pending={loading && i === messages.length - 1} onAdd={addDish} busy={loading} />
                ))}
              </div>
            )}
            <div ref={endRef} />
          </main>

          <div className="border-t border-line px-4 pb-3 pt-3">
            <ChatInput onSend={send} disabled={loading} />
            <p className="mt-2 text-center text-[11px] leading-snug text-muted">
              Protótipo com restaurantes fictícios e pagamento simulado. Não digite dados pessoais.
            </p>
          </div>
        </div>

        <aside
          className={`${cartOpen ? "fixed inset-x-0 bottom-0 top-[61px] z-20 bg-bg" : "hidden"} border-l border-line lg:static lg:block lg:w-80 lg:shrink-0`}
        >
          <CartPanel
            state={agentState}
            busy={loading}
            notice={notice}
            onRemoveItem={(id) => setAgentState((s) => ({ ...s, cart: removeFromCart(s.cart, id) }))}
            onRemovePref={removePref}
            onCheckout={checkout}
          />
        </aside>
      </div>
    </div>
  );
}
