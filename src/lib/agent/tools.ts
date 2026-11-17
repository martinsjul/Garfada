import { Type, type FunctionDeclaration } from "@google/genai";
import { addToCart, cartTotals, removeFromCart } from "../cart";
import { findItem, getMenu, searchDishes, searchRestaurants, violatesPrefs, type DishFilters } from "../catalog/search";
import { EMPTY_CART, TAGS, type AgentState, type DishResult, type Restaurant, type Tag, type ToolStep } from "../types";

const TAG_LIST = [...TAGS];
export const MAX_RECENT = 8;

export const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "buscar_pratos",
    description:
      "Busca pratos no catálogo. Use para pedidos por prato, preço, dieta, tempo de entrega ou rodízio. As restrições salvas do cliente já são aplicadas automaticamente.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        texto: { type: Type.STRING, description: "Palavras-chave: nome do prato, ingrediente ou tipo de comida. Inclua sinônimos (ex.: 'hamburguer burger lanche')." },
        preco_max: { type: Type.NUMBER, description: "Preço máximo por item, em reais." },
        tags: { type: Type.ARRAY, items: { type: Type.STRING, enum: TAG_LIST }, description: "Exigir estas características." },
        categoria: { type: Type.STRING, description: "Categoria do cardápio, ex.: 'bolos', 'massas', 'rodízio'." },
        bairro: { type: Type.STRING },
        tempo_max_min: { type: Type.NUMBER, description: "Tempo máximo de entrega em minutos." },
        rodizio: { type: Type.BOOLEAN, description: "true para restaurantes com rodízio." },
        restaurante_id: { type: Type.STRING, description: "Limitar a um restaurante." },
      },
    },
  },
  {
    name: "buscar_restaurantes",
    description: "Busca restaurantes por tipo de culinária, nome, bairro, preço médio, tempo de entrega ou rodízio.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        texto: { type: Type.STRING, description: "Culinária ou nome, ex.: 'japonesa', 'pizzaria', 'café'." },
        bairro: { type: Type.STRING },
        preco_medio_max: { type: Type.NUMBER, description: "Preço médio máximo dos itens, em reais." },
        tempo_max_min: { type: Type.NUMBER },
        rodizio: { type: Type.BOOLEAN },
      },
    },
  },
  {
    name: "ver_cardapio",
    description: "Mostra o cardápio completo de um restaurante (itens marcados com 'permitido' conforme as restrições).",
    parameters: { type: Type.OBJECT, properties: { restaurante_id: { type: Type.STRING } }, required: ["restaurante_id"] },
  },
  {
    name: "salvar_preferencia",
    description:
      "Salva uma preferência do cliente para o resto da conversa. tipo 'dieta' aceita: vegetariano, vegano, sem_gluten, sem_lactose. tipo 'evitar' é um ingrediente que o cliente não come (ex.: 'camarão'). tipo 'gosto' é algo que ele gosta.",
    parameters: {
      type: Type.OBJECT,
      properties: { tipo: { type: Type.STRING, enum: ["dieta", "evitar", "gosto"] }, valor: { type: Type.STRING } },
      required: ["tipo", "valor"],
    },
  },
  {
    name: "remover_preferencia",
    description: "Remove uma preferência salva antes.",
    parameters: {
      type: Type.OBJECT,
      properties: { tipo: { type: Type.STRING, enum: ["dieta", "evitar", "gosto"] }, valor: { type: Type.STRING } },
      required: ["tipo", "valor"],
    },
  },
  {
    name: "adicionar_ao_carrinho",
    description: "Adiciona um item ao carrinho usando o item_id vindo de buscar_pratos ou ver_cardapio. Um pedido só pode ter itens de um restaurante.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        item_id: { type: Type.STRING },
        quantidade: { type: Type.INTEGER, description: "De 1 a 20. Padrão 1." },
        observacao: { type: Type.STRING, description: "Ex.: 'sem cebola'." },
      },
      required: ["item_id"],
    },
  },
  {
    name: "remover_do_carrinho",
    description: "Remove um item do carrinho (ou só parte da quantidade).",
    parameters: {
      type: Type.OBJECT,
      properties: { item_id: { type: Type.STRING }, quantidade: { type: Type.INTEGER } },
      required: ["item_id"],
    },
  },
  { name: "ver_carrinho", description: "Mostra o carrinho atual com total.", parameters: { type: Type.OBJECT, properties: {} } },
  { name: "esvaziar_carrinho", description: "Remove todos os itens do carrinho.", parameters: { type: Type.OBJECT, properties: {} } },
];

export interface ToolContext {
  catalog: Restaurant[];
  state: AgentState;
}

export interface ToolOutcome {
  response: Record<string, unknown>;
  state: AgentState;
  step: ToolStep;
  dishes?: DishResult[];
}

// ---- conversão segura dos argumentos vindos do modelo ----
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 100) : undefined);
const num = (v: unknown) => {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
};
const bool = (v: unknown) => (typeof v === "boolean" ? v : v === "true" ? true : v === "false" ? false : undefined);
const tags = (v: unknown) => (Array.isArray(v) ? (v.filter((t) => TAG_LIST.includes(t)) as Tag[]) : undefined);
const clean = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && !(Array.isArray(v) && !v.length)));

function cartView(state: AgentState) {
  const t = cartTotals(state.cart);
  return { restaurante: state.cart.restauranteNome ?? null, itens: state.cart.itens, subtotal: t.subtotal, taxa_entrega: t.taxa, total: t.total };
}

export function executeTool(name: string, rawArgs: Record<string, unknown>, ctx: ToolContext): ToolOutcome {
  const { catalog, state } = ctx;
  const fail = (args: Record<string, unknown>, erro: string): ToolOutcome => ({
    response: { erro },
    state,
    step: { name, args, resumo: `⚠️ ${erro}` },
  });

  switch (name) {
    case "buscar_pratos": {
      const args = clean({
        texto: str(rawArgs.texto), preco_max: num(rawArgs.preco_max), tags: tags(rawArgs.tags), categoria: str(rawArgs.categoria),
        bairro: str(rawArgs.bairro), tempo_max_min: num(rawArgs.tempo_max_min), rodizio: bool(rawArgs.rodizio), restaurante_id: str(rawArgs.restaurante_id),
      });
      const dishes = searchDishes(catalog, args as DishFilters, state.prefs);
      return {
        response: { total: dishes.length, pratos: dishes },
        state: dishes.length ? { ...state, recent: dishes.slice(0, MAX_RECENT).map((d) => d.itemId) } : state,
        dishes,
        step: { name, args, resumo: dishes.length ? `${dishes.length} prato(s) encontrado(s)` : "Nenhum prato encontrado" },
      };
    }
    case "buscar_restaurantes": {
      const args = clean({
        texto: str(rawArgs.texto), bairro: str(rawArgs.bairro), preco_medio_max: num(rawArgs.preco_medio_max),
        tempo_max_min: num(rawArgs.tempo_max_min), rodizio: bool(rawArgs.rodizio),
      });
      const found = searchRestaurants(catalog, args, state.prefs);
      return {
        response: { total: found.length, restaurantes: found },
        state,
        step: { name, args, resumo: found.length ? `${found.length} restaurante(s): ${found.map((r) => r.nome).join(", ")}` : "Nenhum restaurante encontrado" },
      };
    }
    case "ver_cardapio": {
      const args = clean({ restaurante_id: str(rawArgs.restaurante_id) });
      const menu = args.restaurante_id ? getMenu(catalog, args.restaurante_id as string, state.prefs) : null;
      if (!menu) return fail(args, "Restaurante não encontrado.");
      return { response: menu, state, step: { name, args, resumo: `Cardápio do ${menu.restaurante.nome} (${menu.itens.length} itens)` } };
    }
    case "salvar_preferencia":
    case "remover_preferencia": {
      const tipo = str(rawArgs.tipo);
      const raw = str(rawArgs.valor);
      const args = clean({ tipo, valor: raw });
      if (!raw || !tipo || !["dieta", "evitar", "gosto"].includes(tipo)) return fail(args, "Preferência inválida.");
      const valor = tipo === "dieta" ? raw.toLowerCase().replace(/\s+/g, "_").replace("glúten", "gluten") : raw.toLowerCase();
      if (tipo === "dieta" && !(TAG_LIST as string[]).includes(valor)) {
        return fail(args, `Dieta não reconhecida. Use: ${TAG_LIST.filter((t) => t !== "apimentado").join(", ")}.`);
      }
      const key = tipo === "dieta" ? "dieta" : tipo === "evitar" ? "evitar" : "gostos";
      const current = state.prefs[key] as string[];
      const next = name === "salvar_preferencia" ? (current.includes(valor) ? current : [...current, valor].slice(-10)) : current.filter((v) => v !== valor);
      const newState: AgentState = { ...state, prefs: { ...state.prefs, [key]: next } };
      return {
        response: { ok: true, preferencias: newState.prefs },
        state: newState,
        step: { name, args, resumo: name === "salvar_preferencia" ? `Lembrar: ${tipo} → ${valor}` : `Esquecer: ${tipo} → ${valor}` },
      };
    }
    case "adicionar_ao_carrinho": {
      const args = clean({ item_id: str(rawArgs.item_id), quantidade: num(rawArgs.quantidade), observacao: str(rawArgs.observacao) });
      const found = args.item_id ? findItem(catalog, args.item_id as string) : null;
      if (!found) return fail(args, "Item não encontrado no catálogo. Use um item_id vindo das buscas.");
      if (violatesPrefs(found.item, state.prefs)) return fail(args, `"${found.item.nome}" viola uma restrição do cliente.`);
      const res = addToCart(state.cart, found.restaurant, found.item, (args.quantidade as number) ?? 1, args.observacao as string | undefined);
      if (!res.ok) return fail(args, res.error);
      const newState = { ...state, cart: res.cart };
      return {
        response: { ok: true, carrinho: cartView(newState) },
        state: newState,
        step: { name, args, resumo: `+${(args.quantidade as number) ?? 1}× ${found.item.nome}` },
      };
    }
    case "remover_do_carrinho": {
      const args = clean({ item_id: str(rawArgs.item_id), quantidade: num(rawArgs.quantidade) });
      if (!state.cart.itens.some((i) => i.itemId === args.item_id)) return fail(args, "Esse item não está no carrinho.");
      const newState = { ...state, cart: removeFromCart(state.cart, args.item_id as string, args.quantidade as number | undefined) };
      return { response: { ok: true, carrinho: cartView(newState) }, state: newState, step: { name, args, resumo: "Item removido do carrinho" } };
    }
    case "ver_carrinho":
      return { response: { carrinho: cartView(state) }, state, step: { name, args: {}, resumo: `${state.cart.itens.length} item(ns) no carrinho` } };
    case "esvaziar_carrinho": {
      const newState = { ...state, cart: EMPTY_CART };
      return { response: { ok: true }, state: newState, step: { name, args: {}, resumo: "Carrinho esvaziado" } };
    }
    default:
      return fail({}, `Ferramenta desconhecida: ${name}`);
  }
}
