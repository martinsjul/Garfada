export type Role = "user" | "assistant";

export interface ChatMessage {
  role: Role;
  text: string;
}

export const TAGS = ["vegetariano", "vegano", "sem_gluten", "sem_lactose", "apimentado"] as const;
export type Tag = (typeof TAGS)[number];

export interface MenuItem {
  id: string;
  nome: string;
  descricao: string;
  preco: number;
  categoria: string;
  tags: Tag[];
}

export interface Restaurant {
  id: string;
  nome: string;
  culinaria: string;
  bairro: string;
  tempoEntregaMin: number;
  taxaEntrega: number;
  nota: number;
  rodizio: boolean;
  origem: "catalogo" | "importado";
  itens: MenuItem[];
}

/** Restrições e gostos que o agente aprende na conversa. */
export interface Preferences {
  dieta: Tag[];
  evitar: string[];
  gostos: string[];
}

export interface CartItem {
  itemId: string;
  nome: string;
  preco: number;
  quantidade: number;
  observacao?: string;
}

export interface Cart {
  restauranteId?: string;
  restauranteNome?: string;
  taxaEntrega: number;
  itens: CartItem[];
}

export interface AgentState {
  prefs: Preferences;
  cart: Cart;
}

export interface DishResult {
  itemId: string;
  nome: string;
  descricao: string;
  preco: number;
  categoria: string;
  tags: Tag[];
  restaurante: Pick<Restaurant, "id" | "nome" | "bairro" | "tempoEntregaMin" | "taxaEntrega" | "nota">;
}

export interface ToolStep {
  name: string;
  args: Record<string, unknown>;
  resumo: string;
}

export type StreamEvent =
  | { type: "tool"; step: ToolStep }
  | { type: "dishes"; dishes: DishResult[] }
  | { type: "state"; state: AgentState }
  | { type: "text"; text: string }
  | { type: "error"; message: string }
  | { type: "done" };

export const EMPTY_PREFS: Preferences = { dieta: [], evitar: [], gostos: [] };
export const EMPTY_CART: Cart = { taxaEntrega: 0, itens: [] };
