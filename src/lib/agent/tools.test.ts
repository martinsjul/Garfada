import { describe, expect, it } from "vitest";
import { executeTool, TOOL_DECLARATIONS } from "./tools";
import { CATALOG } from "@/data/catalog";
import { EMPTY_CART, EMPTY_PREFS, type AgentState } from "../types";

const state = (over: Partial<AgentState> = {}): AgentState => ({ prefs: EMPTY_PREFS, cart: EMPTY_CART, recent: [], ...over });
const ctx = (s = state()) => ({ catalog: CATALOG, state: s });

describe("TOOL_DECLARATIONS", () => {
  it("declara as ferramentas do agente", () => {
    expect(TOOL_DECLARATIONS.map((t) => t.name).sort()).toEqual([
      "adicionar_ao_carrinho", "buscar_pratos", "buscar_restaurantes", "esvaziar_carrinho",
      "remover_do_carrinho", "remover_preferencia", "salvar_preferencia", "ver_cardapio", "ver_carrinho",
    ]);
  });
});

describe("executeTool", () => {
  it("buscar_pratos devolve pratos para o modelo e para os cards, aceitando números como texto", () => {
    const out = executeTool("buscar_pratos", { texto: "feijoada", preco_max: "50" }, ctx());
    expect(out.dishes?.map((d) => d.nome)).toEqual(expect.arrayContaining(["Feijoada Completa", "Feijoada Vegana"]));
    expect(out.dishes?.every((d) => d.preco <= 50)).toBe(true);
    expect(out.response).toMatchObject({ total: out.dishes?.length });
    expect(out.step).toMatchObject({ name: "buscar_pratos", args: { texto: "feijoada", preco_max: 50 } });
    expect(out.step.resumo).toMatch(/prato/);
  });

  it("buscar_pratos guarda os pratos mostrados em state.recent (máx. 8)", () => {
    const out = executeTool("buscar_pratos", { texto: "pizza" }, ctx());
    expect(out.state.recent).toEqual(out.dishes?.map((d) => d.itemId).slice(0, 8));
    const none = executeTool("buscar_pratos", { texto: "xyzabc" }, ctx(state({ recent: ["forno-da-vila-1"] })));
    expect(none.state.recent).toEqual(["forno-da-vila-1"]);
  });

  it("buscar_pratos respeita restrições salvas", () => {
    const out = executeTool("buscar_pratos", { texto: "feijoada" }, ctx(state({ prefs: { ...EMPTY_PREFS, dieta: ["vegano"] } })));
    expect(out.dishes?.map((d) => d.nome)).toEqual(["Feijoada Vegana"]);
  });

  it("salvar_preferencia de dieta valida a tag e evita duplicados", () => {
    const one = executeTool("salvar_preferencia", { tipo: "dieta", valor: "vegetariano" }, ctx());
    expect(one.state.prefs.dieta).toEqual(["vegetariano"]);
    const two = executeTool("salvar_preferencia", { tipo: "dieta", valor: "vegetariano" }, ctx(one.state));
    expect(two.state.prefs.dieta).toEqual(["vegetariano"]);
    const bad = executeTool("salvar_preferencia", { tipo: "dieta", valor: "carnivoro" }, ctx());
    expect(bad.response).toMatchObject({ erro: expect.any(String) });
    expect(bad.state.prefs).toEqual(EMPTY_PREFS);
  });

  it("salvar e remover preferência 'evitar'", () => {
    const one = executeTool("salvar_preferencia", { tipo: "evitar", valor: "Camarão" }, ctx());
    expect(one.state.prefs.evitar).toEqual(["camarão"]);
    const two = executeTool("remover_preferencia", { tipo: "evitar", valor: "camarão" }, ctx(one.state));
    expect(two.state.prefs.evitar).toEqual([]);
  });

  it("adicionar_ao_carrinho com item existente, e erro para item inexistente", () => {
    const ok = executeTool("adicionar_ao_carrinho", { item_id: "cafe-do-largo-3", quantidade: 2 }, ctx());
    expect(ok.state.cart.itens).toEqual([expect.objectContaining({ itemId: "cafe-do-largo-3", quantidade: 2 })]);
    expect(ok.response).toMatchObject({ carrinho: { total: 33.9 } });
    const bad = executeTool("adicionar_ao_carrinho", { item_id: "nao-existe" }, ctx());
    expect(bad.response).toMatchObject({ erro: expect.stringContaining("não encontrado") });
  });

  it("adicionar_ao_carrinho recusa item que viola restrição", () => {
    const out = executeTool("adicionar_ao_carrinho", { item_id: "bar-do-zeca-1" }, ctx(state({ prefs: { ...EMPTY_PREFS, dieta: ["vegetariano"] } })));
    expect(out.response).toMatchObject({ erro: expect.stringContaining("restrição") });
    expect(out.state.cart).toEqual(EMPTY_CART);
  });

  it("ver_cardapio de restaurante inexistente devolve erro", () => {
    expect(executeTool("ver_cardapio", { restaurante_id: "x" }, ctx()).response).toMatchObject({ erro: expect.any(String) });
  });

  it("ferramenta desconhecida devolve erro sem lançar", () => {
    expect(executeTool("hackear", {}, ctx()).response).toMatchObject({ erro: expect.any(String) });
  });
});
