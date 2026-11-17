/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { extractMenu, normalizeDraft, type MenuClient } from "./extract";

const raw = {
  restaurante: { nome: "Cantina Teste", culinaria: "italiana" },
  itens: [
    { nome: "Pizza Margherita", descricao_original: "molho, mussarela", descricao_sugerida: "Clássica e cheirosa", preco: 42, categoria: "Pizzas", tags: ["vegetariano"] },
    { nome: "Salada Verde", descricao_original: "", descricao_sugerida: "Folhas frescas", preco: "19,90", categoria: "saladas", tags: ["vegano", "inventada"] },
    { nome: "", descricao_original: "", descricao_sugerida: "", preco: 10, categoria: "x", tags: [] },
    { nome: "Item sem preço", descricao_original: "", descricao_sugerida: "", preco: 0, categoria: "x", tags: [] },
  ],
  combos_sugeridos: [{ nome: "Combo Família", itens: ["Pizza Margherita", "Salada Verde"], preco_sugerido: 55, motivo: "dá pra dividir" }],
};

describe("normalizeDraft", () => {
  it("limpa itens inválidos, converte preço, filtra tags e garante vegano ⇒ vegetariano", () => {
    const d = normalizeDraft(raw);
    expect(d.restaurante).toEqual({ nome: "Cantina Teste", culinaria: "italiana" });
    expect(d.itens).toEqual([
      { nome: "Pizza Margherita", descricao: "Clássica e cheirosa", descricaoOriginal: "molho, mussarela", preco: 42, categoria: "pizzas", tags: ["vegetariano"] },
      { nome: "Salada Verde", descricao: "Folhas frescas", descricaoOriginal: "", preco: 19.9, categoria: "saladas", tags: ["vegano", "vegetariano"] },
    ]);
    expect(d.combos).toEqual([{ nome: "Combo Família", itens: ["Pizza Margherita", "Salada Verde"], precoSugerido: 55, motivo: "dá pra dividir" }]);
  });

  it("tolera resposta malformada", () => {
    expect(normalizeDraft(null)).toEqual({ restaurante: { nome: "", culinaria: "" }, itens: [], combos: [] });
    expect(normalizeDraft({ itens: "x" }).itens).toEqual([]);
  });
});

describe("extractMenu", () => {
  it("envia a imagem com schema JSON e devolve o rascunho normalizado", async () => {
    const generateContent = vi.fn(async () => ({ text: JSON.stringify(raw) }));
    const client: MenuClient = { generateContent };
    const draft = await extractMenu(client, { data: "QUJD", mimeType: "image/jpeg" }, ["m1"]);
    expect(draft.itens).toHaveLength(2);
    const req = generateContent.mock.calls[0][0] as any;
    expect(req.model).toBe("m1");
    expect(req.config.responseMimeType).toBe("application/json");
    expect(req.config.responseSchema).toBeDefined();
    expect(req.contents[0].parts).toContainEqual({ inlineData: { data: "QUJD", mimeType: "image/jpeg" } });
  });

  it("usa o modelo reserva em 503", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const generateContent = vi.fn()
      .mockRejectedValueOnce({ status: 503 })
      .mockResolvedValueOnce({ text: JSON.stringify(raw) });
    await extractMenu({ generateContent }, { data: "QUJD", mimeType: "image/png" }, ["a", "b"]);
    expect(generateContent.mock.calls.map((c) => (c[0] as any).model)).toEqual(["a", "b"]);
  });

  it("JSON inválido vira rascunho vazio, sem lançar", async () => {
    const draft = await extractMenu({ generateContent: async () => ({ text: "não é json" }) }, { data: "x", mimeType: "image/png" }, ["a"]);
    expect(draft.itens).toEqual([]);
  });
});
