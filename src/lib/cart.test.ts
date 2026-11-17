import { describe, expect, it } from "vitest";
import { addToCart, cartTotals, removeFromCart } from "./cart";
import { EMPTY_CART, type MenuItem, type Restaurant } from "./types";

const item = (id: string, preco: number): MenuItem => ({ id, nome: `Item ${id}`, descricao: "", preco, categoria: "x", tags: [] });
const rest = (id: string, itens: MenuItem[]): Restaurant => ({
  id, nome: `Rest ${id}`, culinaria: "x", bairro: "y", tempoEntregaMin: 30, taxaEntrega: 5, nota: 4, rodizio: false, origem: "catalogo", itens,
});
const A = rest("a", [item("a-1", 10), item("a-2", 25.5)]);
const B = rest("b", [item("b-1", 30)]);

describe("addToCart", () => {
  it("adiciona item, define restaurante e taxa", () => {
    const res = addToCart(EMPTY_CART, A, A.itens[0], 2);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.cart).toMatchObject({ restauranteId: "a", restauranteNome: "Rest a", taxaEntrega: 5 });
    expect(res.cart.itens).toEqual([{ itemId: "a-1", nome: "Item a-1", preco: 10, quantidade: 2 }]);
  });

  it("somar o mesmo item incrementa a quantidade, limitada a 20", () => {
    const one = addToCart(EMPTY_CART, A, A.itens[0], 15);
    const two = one.ok ? addToCart(one.cart, A, A.itens[0], 10) : one;
    expect(two.ok && two.cart.itens[0].quantidade).toBe(20);
  });

  it("recusa item de outro restaurante", () => {
    const one = addToCart(EMPTY_CART, A, A.itens[0], 1);
    const two = one.ok ? addToCart(one.cart, B, B.itens[0], 1) : one;
    expect(two).toEqual({ ok: false, error: expect.stringContaining("Rest a") });
  });

  it("recusa quantidade inválida", () => {
    expect(addToCart(EMPTY_CART, A, A.itens[0], 0).ok).toBe(false);
    expect(addToCart(EMPTY_CART, A, A.itens[0], 1.5).ok).toBe(false);
  });
});

describe("removeFromCart", () => {
  it("diminui quantidade e esvazia o restaurante quando o carrinho fica vazio", () => {
    const one = addToCart(EMPTY_CART, A, A.itens[0], 3);
    if (!one.ok) throw new Error();
    expect(removeFromCart(one.cart, "a-1", 1).itens[0].quantidade).toBe(2);
    expect(removeFromCart(one.cart, "a-1")).toEqual(EMPTY_CART);
  });
});

describe("cartTotals", () => {
  it("calcula subtotal, taxa e total com centavos certos", () => {
    const one = addToCart(EMPTY_CART, A, A.itens[1], 3);
    if (!one.ok) throw new Error();
    expect(cartTotals(one.cart)).toEqual({ subtotal: 76.5, taxa: 5, total: 81.5, quantidade: 3 });
    expect(cartTotals(EMPTY_CART)).toEqual({ subtotal: 0, taxa: 0, total: 0, quantidade: 0 });
  });
});
