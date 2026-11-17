import { EMPTY_CART, type Cart, type MenuItem, type Restaurant } from "./types";

export const MAX_QUANTITY = 20;

export type CartResult = { ok: true; cart: Cart } | { ok: false; error: string };

const round = (n: number) => Math.round(n * 100) / 100;

export function addToCart(cart: Cart, restaurant: Restaurant, item: MenuItem, quantidade = 1, observacao?: string): CartResult {
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > MAX_QUANTITY) {
    return { ok: false, error: `Quantidade inválida: use um número inteiro de 1 a ${MAX_QUANTITY}.` };
  }
  if (cart.itens.length > 0 && cart.restauranteId !== restaurant.id) {
    return {
      ok: false,
      error: `O carrinho já tem itens do ${cart.restauranteNome}. Cada pedido é de um restaurante só: esvazie o carrinho para pedir do ${restaurant.nome}.`,
    };
  }

  const existing = cart.itens.find((i) => i.itemId === item.id);
  const itens = existing
    ? cart.itens.map((i) =>
        i.itemId === item.id
          ? { ...i, quantidade: Math.min(MAX_QUANTITY, i.quantidade + quantidade), ...(observacao && { observacao }) }
          : i,
      )
    : [...cart.itens, { itemId: item.id, nome: item.nome, preco: item.preco, quantidade, ...(observacao && { observacao }) }];

  return { ok: true, cart: { restauranteId: restaurant.id, restauranteNome: restaurant.nome, taxaEntrega: restaurant.taxaEntrega, itens } };
}

export function removeFromCart(cart: Cart, itemId: string, quantidade?: number): Cart {
  const itens = cart.itens
    .map((i) => (i.itemId === itemId ? { ...i, quantidade: quantidade ? i.quantidade - quantidade : 0 } : i))
    .filter((i) => i.quantidade > 0);
  return itens.length === 0 ? EMPTY_CART : { ...cart, itens };
}

export function cartTotals(cart: Cart) {
  const subtotal = round(cart.itens.reduce((s, i) => s + i.preco * i.quantidade, 0));
  const taxa = cart.itens.length ? cart.taxaEntrega : 0;
  return { subtotal, taxa, total: round(subtotal + taxa), quantidade: cart.itens.reduce((s, i) => s + i.quantidade, 0) };
}

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
