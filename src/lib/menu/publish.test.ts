import { describe, expect, it } from "vitest";
import { buildRestaurant, slugify } from "./publish";
import { IMPORTED_ID, sanitizeRestaurant } from "../validate";

describe("slugify", () => {
  it("gera slug sem acentos", () => expect(slugify("Padaria Flor de Lís!")).toBe("padaria-flor-de-lis"));
  it("corta em 24 caracteres e tem fallback", () => {
    expect(slugify("a".repeat(50))).toHaveLength(24);
    expect(slugify("!!!")).toBe("restaurante");
  });
});

describe("buildRestaurant", () => {
  const form = { nome: "Boteco do Seu Lima", culinaria: "boteco", bairro: "Lapa", tempoEntregaMin: 35, taxaEntrega: 4.5, rodizio: false };
  const itens = [
    { nome: "Pastel", descricao: "de queijo", descricaoOriginal: "", preco: 24, categoria: "petiscos", tags: ["vegetariano" as const] },
    { nome: "Torresmo", descricao: "", descricaoOriginal: "", preco: 29, categoria: "petiscos", tags: [] },
  ];

  it("cria restaurante importado com ids válidos que passam na validação do servidor", () => {
    const r = buildRestaurant(form, itens, "x7k2");
    expect(r.id).toBe("imp-boteco-do-seu-lima-x7k2");
    expect(r.id).toMatch(IMPORTED_ID);
    expect(r).toMatchObject({ origem: "importado", nota: 0, bairro: "Lapa", tempoEntregaMin: 35, taxaEntrega: 4.5 });
    expect(r.itens.map((i) => i.id)).toEqual([`${r.id}-1`, `${r.id}-2`]);
    expect(r.itens[0]).toEqual({ id: `${r.id}-1`, nome: "Pastel", descricao: "de queijo", preco: 24, categoria: "petiscos", tags: ["vegetariano"] });
    expect(sanitizeRestaurant(r)).toEqual(r);
  });
});
