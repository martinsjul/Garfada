import "server-only";
import { Type, type Schema } from "@google/genai";
import { getGenAIModels, withModelFallback } from "../ai/models";
import { TAGS, type Tag } from "../types";
import type { Combo, DraftItem, MenuDraft } from "./types";

export type { Combo, DraftItem, MenuDraft };

export interface MenuClient {
  generateContent(req: unknown): Promise<{ text?: string }>;
}

export const MAX_ITEMS = 80;

const MENU_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    restaurante: {
      type: Type.OBJECT,
      properties: {
        nome: { type: Type.STRING, description: "Nome do restaurante, se aparecer na imagem; senão string vazia." },
        culinaria: { type: Type.STRING, description: "Tipo de culinária inferido, ex.: 'pizzaria', 'japonesa', 'cafeteria'." },
      },
      required: ["nome", "culinaria"],
    },
    itens: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          nome: { type: Type.STRING },
          descricao_original: { type: Type.STRING, description: "Descrição exatamente como no cardápio, ou vazio." },
          descricao_sugerida: { type: Type.STRING, description: "Descrição curta e apetitosa (até 120 caracteres), sem inventar ingredientes." },
          preco: { type: Type.NUMBER, description: "Preço em reais (ex.: 42.9)." },
          categoria: { type: Type.STRING, description: "Seção do cardápio em minúsculas, ex.: 'pizzas', 'bebidas'." },
          tags: { type: Type.ARRAY, items: { type: Type.STRING, enum: [...TAGS] } },
        },
        required: ["nome", "descricao_original", "descricao_sugerida", "preco", "categoria", "tags"],
      },
    },
    combos_sugeridos: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          nome: { type: Type.STRING },
          itens: { type: Type.ARRAY, items: { type: Type.STRING } },
          preco_sugerido: { type: Type.NUMBER },
          motivo: { type: Type.STRING },
        },
        required: ["nome", "itens", "preco_sugerido", "motivo"],
      },
    },
  },
  required: ["restaurante", "itens", "combos_sugeridos"],
};

const PROMPT = `Você é um copiloto para donos de restaurante. Leia a foto do cardápio e extraia TODOS os itens com preço.
Regras:
- Não invente itens nem preços: só o que está legível na imagem.
- Tags: marque "vegetariano" só se o item claramente não tem carne/peixe/frutos do mar; "vegano" só se também não tem ovo, leite ou queijo; "sem_gluten" e "sem_lactose" só se for evidente pelo item ou estiver escrito; "apimentado" se houver pimenta.
- descricao_sugerida: reescreva de forma apetitosa e curta, em português, sem inventar ingredientes.
- Sugira de 1 a 3 combos que façam sentido com os itens extraídos, com preço sugerido com um pequeno desconto sobre a soma.`;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const text = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const price = (v: unknown) => {
  const n = typeof v === "string" ? Number(v.replace(/[^\d,.-]/g, "").replace(",", ".")) : v;
  return typeof n === "number" && Number.isFinite(n) && n > 0 && n < 10_000 ? Math.round(n * 100) / 100 : 0;
};

export function normalizeDraft(raw: unknown): MenuDraft {
  const r = isRecord(raw) ? raw : {};
  const rest = isRecord(r.restaurante) ? r.restaurante : {};
  const itens: DraftItem[] = (Array.isArray(r.itens) ? r.itens : [])
    .filter(isRecord)
    .map((i) => {
      const tags = (Array.isArray(i.tags) ? i.tags : []).filter((t): t is Tag => (TAGS as readonly unknown[]).includes(t));
      if (tags.includes("vegano") && !tags.includes("vegetariano")) tags.push("vegetariano");
      const descricaoOriginal = text(i.descricao_original);
      return {
        nome: text(i.nome, 80),
        descricao: text(i.descricao_sugerida) || descricaoOriginal,
        descricaoOriginal,
        preco: price(i.preco),
        categoria: text(i.categoria, 40).toLowerCase() || "outros",
        tags: [...new Set(tags)],
      };
    })
    .filter((i) => i.nome && i.preco > 0)
    .slice(0, MAX_ITEMS);

  const combos: Combo[] = (Array.isArray(r.combos_sugeridos) ? r.combos_sugeridos : [])
    .filter(isRecord)
    .map((c) => ({
      nome: text(c.nome, 80),
      itens: (Array.isArray(c.itens) ? c.itens : []).map((x) => text(x, 80)).filter(Boolean),
      precoSugerido: price(c.preco_sugerido),
      motivo: text(c.motivo),
    }))
    .filter((c) => c.nome && c.itens.length)
    .slice(0, 3);

  return { restaurante: { nome: text(rest.nome, 80), culinaria: text(rest.culinaria, 40) }, itens, combos };
}

export async function extractMenu(client: MenuClient, image: { data: string; mimeType: string }, models: string[]): Promise<MenuDraft> {
  const response = await withModelFallback(models, (model) =>
    client.generateContent({
      model,
      contents: [{ role: "user", parts: [{ inlineData: image }, { text: PROMPT }] }],
      config: { responseMimeType: "application/json", responseSchema: MENU_SCHEMA, temperature: 0.2 },
    }),
  );
  try {
    return normalizeDraft(JSON.parse(response.text ?? ""));
  } catch {
    return normalizeDraft(null);
  }
}

export function getMenuClient(): MenuClient {
  return getGenAIModels() as unknown as MenuClient;
}
