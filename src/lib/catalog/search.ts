import type { DishResult, MenuItem, Preferences, Restaurant, Tag } from "../types";

export interface DishFilters {
  texto?: string;
  preco_max?: number;
  tags?: Tag[];
  categoria?: string;
  bairro?: string;
  tempo_max_min?: number;
  rodizio?: boolean;
  restaurante_id?: string;
}

export interface RestaurantFilters {
  texto?: string;
  bairro?: string;
  preco_medio_max?: number;
  tempo_max_min?: number;
  rodizio?: boolean;
}

export interface RestaurantSummary {
  id: string;
  nome: string;
  culinaria: string;
  bairro: string;
  tempoEntregaMin: number;
  taxaEntrega: number;
  nota: number;
  rodizio: boolean;
  precoMedio: number;
  destaques: string[];
}

const STOPWORDS = new Set(["de", "da", "do", "das", "dos", "com", "sem", "e", "um", "uma", "para", "pra", "no", "na", "em", "o", "a", "os", "as", "que", "quero", "algo", "comida"]);

export function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function tokens(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

/** Uma dieta é atendida quando o item tem a tag (vegano também atende vegetariano e sem lactose). */
function meetsDiet(item: MenuItem, diet: Tag): boolean {
  if (item.tags.includes(diet)) return true;
  if ((diet === "vegetariano" || diet === "sem_lactose") && item.tags.includes("vegano")) return true;
  return diet === "apimentado"; // "apimentado" é gosto, não restrição
}

export function violatesPrefs(item: MenuItem, prefs: Preferences): boolean {
  if (prefs.dieta.some((d) => !meetsDiet(item, d))) return true;
  const text = normalize(`${item.nome} ${item.descricao}`);
  return prefs.evitar.some((e) => {
    const term = normalize(e);
    return term.length > 0 && text.includes(term);
  });
}

function score(fields: { strong: string; medium: string; weak: string }, query: string[]): number {
  const strong = normalize(fields.strong);
  const medium = normalize(fields.medium);
  const weak = normalize(fields.weak);
  let total = 0;
  for (const t of query) {
    if (strong.includes(t)) total += 3;
    else if (medium.includes(t)) total += 2;
    else if (weak.includes(t)) total += 1;
  }
  return total;
}

const SIDE_CATEGORIES = ["bebida", "sobremesa", "acompanhamento", "entrada"];
const isSide = (categoria: string) => SIDE_CATEGORIES.some((c) => normalize(categoria).includes(c));

function restaurantInfo(r: Restaurant): DishResult["restaurante"] {
  return { id: r.id, nome: r.nome, bairro: r.bairro, tempoEntregaMin: r.tempoEntregaMin, taxaEntrega: r.taxaEntrega, nota: r.nota };
}

export function searchDishes(catalog: Restaurant[], f: DishFilters, prefs: Preferences, limit = 8): DishResult[] {
  const query = f.texto ? tokens(f.texto) : [];
  const results: { dish: DishResult; score: number; nota: number }[] = [];

  for (const r of catalog) {
    if (f.restaurante_id && r.id !== f.restaurante_id) continue;
    if (f.bairro && !normalize(r.bairro).includes(normalize(f.bairro))) continue;
    if (f.tempo_max_min !== undefined && r.tempoEntregaMin > f.tempo_max_min) continue;
    if (f.rodizio !== undefined && r.rodizio !== f.rodizio) continue;

    for (const item of r.itens) {
      if (f.preco_max !== undefined && item.preco > f.preco_max) continue;
      if (f.tags?.length && !f.tags.every((t) => meetsDiet(item, t) && (t !== "apimentado" || item.tags.includes(t)))) continue;
      if (f.categoria && !normalize(item.categoria).includes(normalize(f.categoria))) continue;
      if (violatesPrefs(item, prefs)) continue;

      const s = query.length
        ? score({ strong: item.nome, medium: `${item.categoria} ${r.culinaria} ${r.nome}`, weak: item.descricao }, query)
        : isSide(item.categoria) ? 1 : 2;
      if (s === 0) continue;

      results.push({
        score: s,
        nota: r.nota,
        dish: { itemId: item.id, nome: item.nome, descricao: item.descricao, preco: item.preco, categoria: item.categoria, tags: item.tags, restaurante: restaurantInfo(r) },
      });
    }
  }

  return results
    .sort((a, b) => b.score - a.score || b.nota - a.nota || a.dish.preco - b.dish.preco)
    .slice(0, limit)
    .map((x) => x.dish);
}

export function searchRestaurants(catalog: Restaurant[], f: RestaurantFilters, prefs: Preferences, limit = 6): RestaurantSummary[] {
  const query = f.texto ? tokens(f.texto) : [];
  const results: { summary: RestaurantSummary; score: number }[] = [];

  for (const r of catalog) {
    if (f.bairro && !normalize(r.bairro).includes(normalize(f.bairro))) continue;
    if (f.tempo_max_min !== undefined && r.tempoEntregaMin > f.tempo_max_min) continue;
    if (f.rodizio !== undefined && r.rodizio !== f.rodizio) continue;

    const allowed = r.itens.filter((i) => !violatesPrefs(i, prefs));
    if (allowed.length === 0) continue;
    const precoMedio = Math.round((allowed.reduce((s, i) => s + i.preco, 0) / allowed.length) * 100) / 100;
    if (f.preco_medio_max !== undefined && precoMedio > f.preco_medio_max) continue;

    const s = query.length
      ? score({ strong: `${r.nome} ${r.culinaria}`, medium: allowed.map((i) => `${i.nome} ${i.categoria}`).join(" "), weak: r.bairro }, query)
      : 1;
    if (s === 0) continue;

    results.push({
      score: s,
      summary: {
        id: r.id, nome: r.nome, culinaria: r.culinaria, bairro: r.bairro, tempoEntregaMin: r.tempoEntregaMin,
        taxaEntrega: r.taxaEntrega, nota: r.nota, rodizio: r.rodizio, precoMedio,
        destaques: allowed.slice(0, 3).map((i) => i.nome),
      },
    });
  }

  return results.sort((a, b) => b.score - a.score || b.summary.nota - a.summary.nota).slice(0, limit).map((x) => x.summary);
}

export function getMenu(catalog: Restaurant[], restauranteId: string, prefs: Preferences) {
  const r = catalog.find((x) => x.id === restauranteId);
  if (!r) return null;
  return {
    restaurante: restaurantInfo(r),
    rodizio: r.rodizio,
    itens: r.itens.map((i) => ({ ...i, permitido: !violatesPrefs(i, prefs) })),
  };
}

export function findItem(catalog: Restaurant[], itemId: string): { restaurant: Restaurant; item: MenuItem } | null {
  for (const restaurant of catalog) {
    const item = restaurant.itens.find((i) => i.id === itemId);
    if (item) return { restaurant, item };
  }
  return null;
}
