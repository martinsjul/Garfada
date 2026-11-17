import type { Restaurant } from "../types";
import type { DraftItem } from "./types";

export interface RestaurantForm {
  nome: string;
  culinaria: string;
  bairro: string;
  tempoEntregaMin: number;
  taxaEntrega: number;
  rodizio: boolean;
}

export function slugify(text: string): string {
  const slug = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24)
    .replace(/-+$/g, "");
  return slug || "restaurante";
}

export function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6).padEnd(4, "0");
}

export function buildRestaurant(form: RestaurantForm, itens: DraftItem[], suffix = randomSuffix()): Restaurant {
  const id = `imp-${slugify(form.nome)}-${suffix}`;
  return {
    id,
    nome: form.nome.trim(),
    culinaria: form.culinaria.trim() || "variada",
    bairro: form.bairro.trim() || "não informado",
    tempoEntregaMin: Math.round(form.tempoEntregaMin),
    taxaEntrega: Math.round(form.taxaEntrega * 100) / 100,
    nota: 0,
    rodizio: form.rodizio,
    origem: "importado",
    itens: itens.map((i, n) => ({
      id: `${id}-${n + 1}`,
      nome: i.nome.trim(),
      descricao: i.descricao.trim(),
      preco: Math.round(i.preco * 100) / 100,
      categoria: i.categoria.trim() || "outros",
      tags: i.tags,
    })),
  };
}
