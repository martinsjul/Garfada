import { describe, expect, it } from "vitest";
import { parseChatBody, rebuildCart, sanitizePrefs, sanitizeRestaurant } from "./validate";
import { CATALOG } from "@/data/catalog";
import { EMPTY_CART, EMPTY_PREFS } from "./types";

const msg = (text: string, role = "user") => ({ role, text });

describe("parseChatBody", () => {
  it("aceita conversa válida sem estado (usa estado vazio)", () => {
    expect(parseChatBody({ messages: [msg("oi")] })).toEqual({
      ok: true, messages: [msg("oi")], state: { prefs: EMPTY_PREFS, cart: EMPTY_CART }, imported: [],
    });
  });

  it.each(["", "   \n "])("rejeita última mensagem vazia (%j)", (text) => {
    expect(parseChatBody({ messages: [msg(text)] })).toEqual({ ok: false, error: "Escreva uma mensagem." });
  });

  it("rejeita mensagem com mais de 500 caracteres", () => {
    expect(parseChatBody({ messages: [msg("a".repeat(501))] })).toEqual({ ok: false, error: "Mensagem muito longa (máx. 500 caracteres)." });
  });

  it.each([null, "texto", {}, { messages: [] }, { messages: [msg("oi", "assistant")] }, { messages: [{ role: "system", text: "x" }, msg("oi")] }])(
    "rejeita requisição inválida (%j)",
    (body) => expect(parseChatBody(body)).toEqual({ ok: false, error: "Requisição inválida." }),
  );

  it("corta respostas longas da IA no histórico em vez de rejeitar", () => {
    const res = parseChatBody({ messages: [msg("oi"), msg("x".repeat(9000), "assistant"), msg("e aí")] });
    expect(res.ok && res.messages[1].text.length).toBe(4000);
  });

  it("começa o histórico por uma mensagem do usuário", () => {
    const res = parseChatBody({ messages: [msg("resposta antiga", "assistant"), msg("oi")] });
    expect(res.ok && res.messages).toEqual([msg("oi")]);
  });

  it("aceita até 5 restaurantes importados e ignora os inválidos", () => {
    const imp = (id: string) => ({ id, nome: "Imp", culinaria: "x", bairro: "y", tempoEntregaMin: 30, taxaEntrega: 5, nota: 0, rodizio: false, itens: [] });
    const res = parseChatBody({ messages: [msg("oi")], restaurantes: [imp("imp-a"), imp("ruim id!"), ...["b", "c", "d", "e", "f"].map((x) => imp(`imp-${x}`))] });
    expect(res.ok && res.imported.map((r) => r.id)).toEqual(["imp-a", "imp-b", "imp-c", "imp-d", "imp-e"]);
  });
});

describe("sanitizeRestaurant", () => {
  it("força origem importado, limita campos e limpa itens", () => {
    const r = sanitizeRestaurant({
      id: "imp-cantina", nome: "Cantina", culinaria: "italiana", bairro: "Centro", tempoEntregaMin: 999, taxaEntrega: -3, nota: 9, rodizio: "sim", origem: "catalogo",
      itens: [
        { id: "imp-cantina-1", nome: "Pizza", descricao: "boa", preco: 40, categoria: "pizzas", tags: ["vegetariano", "hack"] },
        { id: "outro-1", nome: "Intruso", descricao: "", preco: 10, categoria: "x", tags: [] },
        { id: "imp-cantina-3", nome: "Grátis", descricao: "", preco: 0, categoria: "x", tags: [] },
      ],
    });
    expect(r).toMatchObject({ id: "imp-cantina", origem: "importado", tempoEntregaMin: 180, taxaEntrega: 0, nota: 5, rodizio: false });
    expect(r?.itens).toEqual([{ id: "imp-cantina-1", nome: "Pizza", descricao: "boa", preco: 40, categoria: "pizzas", tags: ["vegetariano"] }]);
  });

  it("rejeita sem nome ou com id fora do padrão", () => {
    expect(sanitizeRestaurant({ id: "imp-x", nome: "" })).toBeNull();
    expect(sanitizeRestaurant({ id: "forno-da-vila", nome: "Clone" })).toBeNull();
  });
});

describe("sanitizePrefs", () => {
  it("mantém só dietas válidas e textos curtos", () => {
    expect(sanitizePrefs({ dieta: ["vegano", "carnivoro"], evitar: ["camarão", 5, "x".repeat(80)], gostos: "pimenta" })).toEqual({
      dieta: ["vegano"], evitar: ["camarão"], gostos: [],
    });
  });
});

describe("rebuildCart", () => {
  it("usa nome e preço do catálogo, ignorando o que o cliente mandou", () => {
    const cart = rebuildCart({ itens: [{ itemId: "cafe-do-largo-3", nome: "Hack", preco: 0.01, quantidade: 2 }] }, CATALOG);
    expect(cart).toEqual({
      restauranteId: "cafe-do-largo", restauranteNome: "Café do Largo", taxaEntrega: 3.9,
      itens: [{ itemId: "cafe-do-largo-3", nome: "Bolo de Cenoura com Chocolate", preco: 15, quantidade: 2 }],
    });
  });

  it("descarta itens inexistentes, de outro restaurante ou com quantidade inválida", () => {
    const cart = rebuildCart({ itens: [
      { itemId: "cafe-do-largo-1", quantidade: 1 },
      { itemId: "bar-do-zeca-1", quantidade: 1 },
      { itemId: "nao-existe", quantidade: 1 },
      { itemId: "cafe-do-largo-2", quantidade: 50 },
    ] }, CATALOG);
    expect(cart.itens.map((i) => i.itemId)).toEqual(["cafe-do-largo-1"]);
    expect(rebuildCart("lixo", CATALOG)).toEqual(EMPTY_CART);
  });
});
