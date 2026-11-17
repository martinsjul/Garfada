import { CATALOG } from "@/data/catalog";
import { findItem } from "./catalog/search";
import { MAX_QUANTITY } from "./cart";
import { MAX_MESSAGE_LENGTH } from "./limits";
import { EMPTY_CART, TAGS, type AgentState, type Cart, type ChatMessage, type MenuItem, type Preferences, type Restaurant, type Tag } from "./types";

export { MAX_MESSAGE_LENGTH };

const MAX_ASSISTANT_LENGTH = 4000;
const MAX_HISTORY = 10;
export const MAX_IMPORTED = 5;
export const MAX_IMPORTED_ITEMS = 80;
export const IMPORTED_ID = /^imp-[a-z0-9-]{1,40}$/;

type ParseResult =
  | { ok: true; messages: ChatMessage[]; state: AgentState; imported: Restaurant[] }
  | { ok: false; error: string };

const INVALID = { ok: false as const, error: "Requisição inválida." };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const clamp = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
const isTag = (t: unknown): t is Tag => (TAGS as readonly unknown[]).includes(t);

export function sanitizePrefs(raw: unknown): Preferences {
  const r = isRecord(raw) ? raw : {};
  const list = (v: unknown) =>
    (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === "string" && x.trim().length > 0 && x.length <= 40).slice(0, 10);
  return { dieta: (Array.isArray(r.dieta) ? r.dieta : []).filter(isTag).slice(0, 5), evitar: list(r.evitar), gostos: list(r.gostos) };
}

export function sanitizeRestaurant(raw: unknown): Restaurant | null {
  if (!isRecord(raw) || typeof raw.id !== "string" || !IMPORTED_ID.test(raw.id)) return null;
  const nome = text(raw.nome, 80);
  if (!nome) return null;
  const id = raw.id;
  const itens: MenuItem[] = (Array.isArray(raw.itens) ? raw.itens : [])
    .filter(isRecord)
    .filter((i) => typeof i.id === "string" && i.id.startsWith(`${id}-`) && i.id.length <= 60)
    .map((i) => ({
      id: i.id as string,
      nome: text(i.nome, 80),
      descricao: text(i.descricao, 200),
      preco: typeof i.preco === "number" && i.preco > 0 && i.preco < 10_000 ? Math.round(i.preco * 100) / 100 : 0,
      categoria: text(i.categoria, 40) || "outros",
      tags: (Array.isArray(i.tags) ? i.tags : []).filter(isTag),
    }))
    .filter((i) => i.nome && i.preco > 0)
    .slice(0, MAX_IMPORTED_ITEMS);

  return {
    id,
    nome,
    culinaria: text(raw.culinaria, 40) || "variada",
    bairro: text(raw.bairro, 40) || "não informado",
    tempoEntregaMin: Math.round(clamp(raw.tempoEntregaMin, 5, 180, 40)),
    taxaEntrega: Math.round(clamp(raw.taxaEntrega, 0, 50, 0) * 100) / 100,
    nota: clamp(raw.nota, 0, 5, 0),
    rodizio: raw.rodizio === true,
    origem: "importado",
    itens,
  };
}

/** Reconstrói o carrinho a partir do catálogo: nome, preço e taxa nunca vêm do cliente. */
export function rebuildCart(raw: unknown, catalog: Restaurant[]): Cart {
  if (!isRecord(raw) || !Array.isArray(raw.itens)) return EMPTY_CART;
  let restaurant: Restaurant | undefined;
  const itens: Cart["itens"] = [];
  for (const entry of raw.itens.slice(0, 30)) {
    if (!isRecord(entry) || typeof entry.itemId !== "string") continue;
    const q = entry.quantidade;
    if (typeof q !== "number" || !Number.isInteger(q) || q < 1 || q > MAX_QUANTITY) continue;
    const found = findItem(catalog, entry.itemId);
    if (!found || (restaurant && found.restaurant.id !== restaurant.id)) continue;
    if (itens.some((i) => i.itemId === found.item.id)) continue;
    restaurant = found.restaurant;
    const observacao = text(entry.observacao, 100);
    itens.push({ itemId: found.item.id, nome: found.item.nome, preco: found.item.preco, quantidade: q, ...(observacao && { observacao }) });
  }
  if (!restaurant) return EMPTY_CART;
  return { restauranteId: restaurant.id, restauranteNome: restaurant.nome, taxaEntrega: restaurant.taxaEntrega, itens };
}

function isMessage(value: unknown): value is ChatMessage {
  return isRecord(value) && typeof value.text === "string" && (value.role === "user" || value.role === "assistant");
}

export function parseChatBody(body: unknown): ParseResult {
  if (!isRecord(body) || !Array.isArray(body.messages) || body.messages.length === 0) return INVALID;

  const recent: unknown[] = body.messages.slice(-MAX_HISTORY);
  if (!recent.every(isMessage)) return INVALID;
  const last = recent[recent.length - 1] as ChatMessage;
  if (last.role !== "user") return INVALID;
  if (last.text.trim() === "") return { ok: false, error: "Escreva uma mensagem." };
  if (last.text.length > MAX_MESSAGE_LENGTH) return { ok: false, error: `Mensagem muito longa (máx. ${MAX_MESSAGE_LENGTH} caracteres).` };

  let messages = (recent as ChatMessage[])
    .filter((m) => m.text.trim() !== "")
    .map((m) => ({ role: m.role, text: m.text.slice(0, m.role === "user" ? MAX_MESSAGE_LENGTH : MAX_ASSISTANT_LENGTH) }));
  const firstUser = messages.findIndex((m) => m.role === "user");
  messages = messages.slice(firstUser);

  const imported = (Array.isArray(body.restaurantes) ? body.restaurantes : [])
    .map(sanitizeRestaurant)
    .filter((r): r is Restaurant => r !== null)
    .slice(0, MAX_IMPORTED);

  const state = isRecord(body.state) ? body.state : {};
  const catalog = [...CATALOG, ...imported];
  const recentIds = [...new Set((Array.isArray(state.recent) ? state.recent : []).filter((id): id is string => typeof id === "string"))]
    .filter((id) => findItem(catalog, id) !== null)
    .slice(0, 8);
  return { ok: true, messages, state: { prefs: sanitizePrefs(state.prefs), cart: rebuildCart(state.cart, catalog), recent: recentIds }, imported };
}
