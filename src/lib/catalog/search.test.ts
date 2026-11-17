import { describe, expect, it } from "vitest";
import { getMenu, normalize, searchDishes, searchRestaurants, violatesPrefs } from "./search";
import { EMPTY_PREFS, type Restaurant } from "../types";

const r = (over: Partial<Restaurant>): Restaurant => ({
  id: "r1", nome: "Casa", culinaria: "brasileira", bairro: "Pinheiros", tempoEntregaMin: 30,
  taxaEntrega: 5, nota: 4.5, rodizio: false, origem: "catalogo", itens: [], ...over,
});

const catalog: Restaurant[] = [
  r({
    id: "pizza", nome: "Forno da Vila", culinaria: "pizzaria", bairro: "Vila Madalena", tempoEntregaMin: 40, rodizio: true,
    itens: [
      { id: "pizza-1", nome: "Pizza Margherita", descricao: "molho de tomate, mussarela e manjericão", preco: 52, categoria: "pizzas", tags: ["vegetariano"] },
      { id: "pizza-2", nome: "Pizza de Camarão", descricao: "camarão e catupiry", preco: 79, categoria: "pizzas", tags: [] },
      { id: "pizza-3", nome: "Pizza Vegana de Abobrinha", descricao: "queijo de castanha", preco: 58, categoria: "pizzas", tags: ["vegano", "vegetariano", "sem_lactose"] },
    ],
  }),
  r({
    id: "japa", nome: "Sushi Liberdade", culinaria: "japonesa", bairro: "Liberdade", tempoEntregaMin: 25,
    itens: [
      { id: "japa-1", nome: "Temaki de Salmão", descricao: "salmão fresco e cebolinha", preco: 34, categoria: "temakis", tags: ["sem_gluten"] },
      { id: "japa-2", nome: "Yakisoba de Legumes", descricao: "macarrão com legumes", preco: 39, categoria: "pratos quentes", tags: ["vegetariano"] },
    ],
  }),
];

describe("normalize", () => {
  it("remove acentos e caixa", () => expect(normalize("Camarão À Milanesa")).toBe("camarao a milanesa"));
});

describe("searchDishes", () => {
  it("acha por texto sem acento e ordena por relevância (nome antes de descrição)", () => {
    const res = searchDishes(catalog, { texto: "camarao" }, EMPTY_PREFS);
    expect(res.map((d) => d.itemId)).toEqual(["pizza-2"]);
    expect(res[0].restaurante).toMatchObject({ id: "pizza", nome: "Forno da Vila" });
  });

  it("filtra por preço máximo, tags e tempo de entrega", () => {
    expect(searchDishes(catalog, { preco_max: 40 }, EMPTY_PREFS).map((d) => d.itemId).sort()).toEqual(["japa-1", "japa-2"]);
    expect(searchDishes(catalog, { tags: ["vegano"] }, EMPTY_PREFS).map((d) => d.itemId)).toEqual(["pizza-3"]);
    expect(searchDishes(catalog, { tempo_max_min: 30 }, EMPTY_PREFS).every((d) => d.restaurante.id === "japa")).toBe(true);
  });

  it("aceita qualquer palavra do texto (pizza OU temaki)", () => {
    expect(searchDishes(catalog, { texto: "temaki pizza vegana" }, EMPTY_PREFS)[0].itemId).toBe("pizza-3");
  });

  it("filtra por rodízio e bairro", () => {
    expect(searchDishes(catalog, { rodizio: true }, EMPTY_PREFS).every((d) => d.restaurante.id === "pizza")).toBe(true);
    expect(searchDishes(catalog, { bairro: "liberdade" }, EMPTY_PREFS).every((d) => d.restaurante.id === "japa")).toBe(true);
  });

  it("aplica restrições das preferências mesmo sem o filtro pedir", () => {
    const veg = searchDishes(catalog, {}, { ...EMPTY_PREFS, dieta: ["vegetariano"] });
    expect(veg.map((d) => d.itemId).sort()).toEqual(["japa-2", "pizza-1", "pizza-3"]);
    const semCamarao = searchDishes(catalog, { texto: "pizza" }, { ...EMPTY_PREFS, evitar: ["camarão"] });
    expect(semCamarao.map((d) => d.itemId)).not.toContain("pizza-2");
  });

  it("sem texto, pratos principais vêm antes de bebidas e sobremesas", () => {
    const withDrink: Restaurant[] = [
      r({ id: "x", nota: 5, itens: [{ id: "x-1", nome: "Suco", descricao: "", preco: 8, categoria: "bebidas", tags: [] }] }),
      r({ id: "y", nota: 4, itens: [{ id: "y-1", nome: "Marmita", descricao: "", preco: 25, categoria: "marmitas", tags: [] }] }),
    ];
    expect(searchDishes(withDrink, {}, EMPTY_PREFS).map((d) => d.itemId)).toEqual(["y-1", "x-1"]);
  });

  it("limita a quantidade de resultados", () => {
    expect(searchDishes(catalog, {}, EMPTY_PREFS, 2)).toHaveLength(2);
  });
});

describe("violatesPrefs", () => {
  const item = catalog[0].itens[0];
  it("vegano exige a tag vegano; vegetariano aceita vegano", () => {
    expect(violatesPrefs(item, { ...EMPTY_PREFS, dieta: ["vegano"] })).toBe(true);
    expect(violatesPrefs(catalog[0].itens[2], { ...EMPTY_PREFS, dieta: ["vegetariano"] })).toBe(false);
  });
  it("evitar entende plural e singular nos dois sentidos", () => {
    const camarao = catalog[0].itens[1]; // Pizza de Camarão
    expect(violatesPrefs(camarao, { ...EMPTY_PREFS, evitar: ["camarões"] })).toBe(true);
    const plural = { ...camarao, nome: "Camarões empanados", descricao: "" };
    expect(violatesPrefs(plural, { ...EMPTY_PREFS, evitar: ["camarão"] })).toBe(true);
  });

  it("evitar 'frutos do mar' bloqueia camarão, mas não bloqueia palavras parecidas", () => {
    expect(violatesPrefs(catalog[0].itens[1], { ...EMPTY_PREFS, evitar: ["frutos do mar"] })).toBe(true);
    expect(violatesPrefs({ ...catalog[0].itens[0], nome: "Pão de queijo", descricao: "" }, { ...EMPTY_PREFS, evitar: ["pães"] })).toBe(true);
    expect(violatesPrefs({ ...catalog[0].itens[0], nome: "Ovomaltine", descricao: "" }, { ...EMPTY_PREFS, evitar: ["ovo"] })).toBe(false);
  });

  it("evitar procura no nome e na descrição", () => {
    expect(violatesPrefs(item, { ...EMPTY_PREFS, evitar: ["manjericao"] })).toBe(true);
  });
});

describe("searchRestaurants", () => {
  it("acha por culinária e calcula preço médio", () => {
    const res = searchRestaurants(catalog, { texto: "japones" }, EMPTY_PREFS);
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ id: "japa", precoMedio: 36.5 });
  });
  it("filtra por preço médio máximo e rodízio", () => {
    expect(searchRestaurants(catalog, { preco_medio_max: 40 }, EMPTY_PREFS).map((x) => x.id)).toEqual(["japa"]);
    expect(searchRestaurants(catalog, { rodizio: true }, EMPTY_PREFS).map((x) => x.id)).toEqual(["pizza"]);
  });
});

describe("getMenu", () => {
  it("devolve o cardápio marcando itens que violam preferências", () => {
    const menu = getMenu(catalog, "pizza", { ...EMPTY_PREFS, dieta: ["vegetariano"] });
    expect(menu?.itens.find((i) => i.id === "pizza-2")?.permitido).toBe(false);
    expect(menu?.itens.find((i) => i.id === "pizza-1")?.permitido).toBe(true);
  });
  it("devolve null para restaurante inexistente", () => expect(getMenu(catalog, "nao-existe", EMPTY_PREFS)).toBeNull());
});
