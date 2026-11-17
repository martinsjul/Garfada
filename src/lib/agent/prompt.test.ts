import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "./prompt";
import { CATALOG } from "@/data/catalog";
import { EMPTY_CART, EMPTY_PREFS } from "../types";

describe("buildSystemPrompt", () => {
  it("lista os pratos da última busca com item_id, nome e preço, na ordem", () => {
    const p = buildSystemPrompt({ prefs: EMPTY_PREFS, cart: EMPTY_CART, recent: ["trattoria-bixiga-4", "raiz-vegana-4"] }, CATALOG);
    expect(p).toContain("1. Nhoque ao Sugo — R$ 44.00 — Trattoria do Bixiga (item_id trattoria-bixiga-4)");
    expect(p).toContain("2. Lasanha de Berinjela — R$ 46.00 — Raiz Cozinha Vegana (item_id raiz-vegana-4)");
  });

  it("mostra preferências e carrinho vazio", () => {
    const p = buildSystemPrompt({ prefs: { ...EMPTY_PREFS, dieta: ["vegano"], evitar: ["cogumelo"] }, cart: EMPTY_CART, recent: [] }, CATALOG);
    expect(p).toContain("dieta: vegano; evita: cogumelo");
    expect(p).toContain("Carrinho: vazio");
    expect(p).toContain("Pratos mostrados na última busca: nenhum");
  });
});
