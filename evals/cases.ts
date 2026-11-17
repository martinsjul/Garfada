import { CATALOG } from "../src/data/catalog";
import { findItem, normalize } from "../src/lib/catalog/search";
import { EMPTY_CART, EMPTY_STATE, type AgentState, type ChatMessage, type DishResult, type ToolStep } from "../src/lib/types";

export interface EvalResult {
  steps: ToolStep[];
  dishes: DishResult[];
  state: AgentState;
  text: string;
  error?: string;
}

export interface EvalCase {
  id: string;
  descricao: string;
  messages: ChatMessage[];
  state?: AgentState;
  /** Cada verificação devolve null (passou) ou o motivo da falha. */
  checks: ((r: EvalResult) => string | null)[];
}

const user = (text: string): ChatMessage => ({ role: "user", text });
const restaurantOf = (d: DishResult) => CATALOG.find((r) => r.id === d.restaurante.id)!;

// ---- verificações reutilizáveis ----
const called = (name: string, pred: (args: Record<string, unknown>) => boolean = () => true, label = name) => (r: EvalResult) =>
  r.steps.some((s) => s.name === name && pred(s.args)) ? null : `não chamou ${label}`;
const notCalled = (name: string) => (r: EvalResult) => (r.steps.some((s) => s.name === name) ? `chamou ${name} sem precisar` : null);
const someDishes = (r: EvalResult) => (r.dishes.length ? null : "nenhum prato mostrado");
const allDishes = (label: string, pred: (d: DishResult) => boolean) => (r: EvalResult) => {
  const bad = r.dishes.filter((d) => !pred(d));
  return bad.length ? `${label}: ${bad.map((d) => d.nome).join(", ")}` : null;
};
const noError = (r: EvalResult) => (r.error ? `erro: ${r.error}` : null);
const textMatches = (re: RegExp, label: string) => (r: EvalResult) => (re.test(normalize(r.text)) ? null : `texto não ${label}`);
const textMentionsOnlyKnownPrices = (r: EvalResult) => {
  // Todo "R$ X" citado no texto precisa existir no catálogo (item, taxa ou total do carrinho).
  const known = new Set<number>(CATALOG.flatMap((x) => [...x.itens.map((i) => i.preco), x.taxaEntrega]));
  const cartTotal = r.state.cart.itens.reduce((s, i) => s + i.preco * i.quantidade, 0);
  [cartTotal, cartTotal + r.state.cart.taxaEntrega].forEach((v) => known.add(Math.round(v * 100) / 100));
  r.state.cart.itens.forEach((i) => known.add(Math.round(i.preco * i.quantidade * 100) / 100));
  const cited = [...r.text.matchAll(/R\$\s?(\d+(?:[.,]\d{1,2})?)/g)].map((m) => Number(m[1].replace(",", ".")));
  const unknown = cited.filter((v) => !known.has(v) && v % 5 !== 0); // valores redondos (ex.: "até R$ 50") podem ser do pedido
  return unknown.length ? `preço inventado no texto: ${unknown.join(", ")}` : null;
};

export const CASES: EvalCase[] = [
  {
    id: "preco-maximo",
    descricao: "Respeita o preço máximo pedido",
    messages: [user("Quero uma feijoada até R$ 50")],
    checks: [noError, called("buscar_pratos", (a) => typeof a.preco_max === "number" && a.preco_max <= 50, "buscar_pratos com preco_max ≤ 50"), someDishes, allDishes("acima de R$ 50", (d) => d.preco <= 50), textMentionsOnlyKnownPrices],
  },
  {
    id: "dieta-vegana",
    descricao: "Salva a dieta e só mostra pratos veganos",
    messages: [user("Sou vegana. O que você me indica pro jantar?")],
    checks: [noError, called("salvar_preferencia", (a) => a.tipo === "dieta" && a.valor === "vegano", "salvar_preferencia dieta=vegano"), someDishes, allDishes("não vegano", (d) => d.tags.includes("vegano"))],
  },
  {
    id: "evitar-ingrediente",
    descricao: "Lembra ingrediente que o cliente não come",
    messages: [user("Não como camarão de jeito nenhum. Me indica uma pizza?")],
    checks: [noError, called("salvar_preferencia", (a) => a.tipo === "evitar" && normalize(String(a.valor)).includes("camarao"), "salvar_preferencia evitar=camarão"), someDishes, allDishes("contém camarão", (d) => !normalize(`${d.nome} ${d.descricao}`).includes("camarao"))],
  },
  {
    id: "evitar-plural",
    descricao: "Restrição no plural continua valendo (camarões × camarão)",
    messages: [user("Tenho alergia a camarões. Quero um risoto ou algo italiano")],
    checks: [noError, called("salvar_preferencia", (a) => a.tipo === "evitar", "salvar_preferencia evitar"), allDishes("contém camarão", (d) => !normalize(`${d.nome} ${d.descricao}`).includes("camara"))],
  },
  {
    id: "rodizio",
    descricao: "Entende pedido de rodízio",
    messages: [user("Quero um rodízio pra hoje à noite")],
    checks: [noError, someDishes, allDishes("restaurante sem rodízio", (d) => restaurantOf(d).rodizio)],
  },
  {
    id: "entrega-rapida",
    descricao: "Filtra por tempo de entrega",
    messages: [user("Café com bolo que chegue em até 25 minutos")],
    checks: [noError, called("buscar_pratos", (a) => typeof a.tempo_max_min === "number" && a.tempo_max_min <= 25, "buscar_pratos com tempo_max_min ≤ 25"), someDishes, allDishes("entrega acima de 25 min", (d) => d.restaurante.tempoEntregaMin <= 25)],
  },
  {
    id: "carrinho-referencia",
    descricao: "Adiciona ao carrinho referindo-se à busca anterior",
    messages: [user("Quero café com bolo"), { role: "assistant", text: "Que tal o **Bolo de Cenoura com Chocolate** (R$ 15) ou o **Bolo de Fubá com Goiabada** (R$ 13) do Café do Largo?" }, user("Coloca 2 do de cenoura")],
    state: { ...EMPTY_STATE, recent: ["cafe-do-largo-3", "cafe-do-largo-4", "cafe-do-largo-6"] },
    checks: [noError, (r) => (r.state.cart.itens.some((i) => i.itemId === "cafe-do-largo-3" && i.quantidade === 2) ? null : "carrinho sem 2× Bolo de Cenoura"), textMentionsOnlyKnownPrices],
  },
  {
    id: "um-restaurante-por-pedido",
    descricao: "Explica que não dá pra misturar restaurantes",
    messages: [user("Adiciona também uma Feijoada Completa do Bar do Zeca")],
    state: { ...EMPTY_STATE, cart: { restauranteId: "cafe-do-largo", restauranteNome: "Café do Largo", taxaEntrega: 3.9, itens: [{ itemId: "cafe-do-largo-1", nome: "Café Coado", preco: 9, quantidade: 1 }] } },
    checks: [noError, (r) => (r.state.cart.itens.every((i) => findItem(CATALOG, i.itemId)?.restaurant.id === r.state.cart.restauranteId) ? null : "carrinho com dois restaurantes"), textMatches(/restaurante|esvazi/, "explica a regra de um restaurante")],
  },
  {
    id: "fora-do-tema",
    descricao: "Recusa educadamente assunto fora de comida",
    messages: [user("Qual é a capital da França?")],
    checks: [noError, notCalled("adicionar_ao_carrinho"), (r) => (r.dishes.length === 0 ? null : "mostrou pratos sem motivo"), textMatches(/comida|pedido|comer|restaurante/, "redireciona para comida")],
  },
  {
    id: "nao-inventa",
    descricao: "Não inventa prato que não existe",
    messages: [user("Vocês têm sushi de lagosta?")],
    checks: [noError, called("buscar_pratos"), allDishes("prato com lagosta (não existe)", (d) => !normalize(d.nome).includes("lagosta")), textMatches(/nao (encontrei|temos|achei|tem|ha)|infelizmente|nenhum/, "admite que não tem")],
  },
  {
    id: "orcamento-baixo",
    descricao: "Almoço barato",
    messages: [user("Preciso de um almoço barato, até R$ 25")],
    checks: [noError, someDishes, allDishes("acima de R$ 25", (d) => d.preco <= 25), textMentionsOnlyKnownPrices],
  },
];

export { EMPTY_CART };
