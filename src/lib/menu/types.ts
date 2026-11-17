import type { Tag } from "../types";

export interface DraftItem {
  nome: string;
  descricao: string;
  descricaoOriginal: string;
  preco: number;
  categoria: string;
  tags: Tag[];
}

export interface Combo {
  nome: string;
  itens: string[];
  precoSugerido: number;
  motivo: string;
}

export interface MenuDraft {
  restaurante: { nome: string; culinaria: string };
  itens: DraftItem[];
  combos: Combo[];
}

