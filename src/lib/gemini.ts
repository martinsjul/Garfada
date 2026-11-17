import "server-only";
import { GoogleGenAI } from "@google/genai";
import { extractPlaces } from "./places";
import { SYSTEM_PROMPT } from "./systemPrompt";
import type { ChatMessage, LatLng, StreamEvent } from "./types";

export const QUOTA_MESSAGE = "A demo atingiu o limite gratuito de hoje. Volte amanhã! 🙏";
export const GENERIC_ERROR = "Ops, algo deu errado ao falar com a IA. Tente de novo.";

const MAX_HISTORY = 10;
const DEFAULT_MODEL = "gemini-3.5-flash";

type StreamChunk = { text?: string; candidates?: { groundingMetadata?: unknown }[] };

export interface GenAIStreamClient {
  generateContentStream(req: unknown): Promise<AsyncIterable<StreamChunk>>;
}

export function buildRequest(messages: ChatMessage[], location?: LatLng, model?: string) {
  return {
    model: model ?? process.env.GEMINI_MODEL ?? DEFAULT_MODEL,
    contents: messages.slice(-MAX_HISTORY).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.text }],
    })),
    config: {
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ googleMaps: {} }],
      ...(location && { toolConfig: { retrievalConfig: { latLng: location, languageCode: "pt-BR" } } }),
    },
  };
}

function isQuotaError(error: unknown): boolean {
  const e = error as { status?: unknown; message?: unknown } | null;
  return e?.status === 429 || (typeof e?.message === "string" && e.message.includes("RESOURCE_EXHAUSTED"));
}

export async function* streamChat(
  client: GenAIStreamClient,
  messages: ChatMessage[],
  location?: LatLng,
): AsyncGenerator<StreamEvent> {
  try {
    const stream = await client.generateContentStream(buildRequest(messages, location));
    // O grounding pode vir espalhado em vários chunks: junta todos (extractPlaces deduplica).
    const groundingChunks: unknown[] = [];
    for await (const chunk of stream) {
      if (chunk.text) yield { type: "text", text: chunk.text };
      const metadata = chunk.candidates?.[0]?.groundingMetadata as { groundingChunks?: unknown } | undefined;
      if (Array.isArray(metadata?.groundingChunks)) groundingChunks.push(...metadata.groundingChunks);
    }
    const places = extractPlaces({ groundingChunks });
    if (places.length > 0) yield { type: "places", places };
    yield { type: "done" };
  } catch (error) {
    console.error("[gemini] erro ao gerar resposta:", error);
    yield { type: "error", message: isQuotaError(error) ? QUOTA_MESSAGE : GENERIC_ERROR };
  }
}

export function getDefaultClient(): GenAIStreamClient {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }).models as unknown as GenAIStreamClient;
}
