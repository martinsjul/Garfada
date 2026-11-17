import "server-only";
import { GoogleGenAI } from "@google/genai";

export const QUOTA_MESSAGE = "A demo atingiu o limite gratuito de hoje. Volte amanhã! 🙏";
export const OVERLOAD_MESSAGE = "A IA está sobrecarregada agora. Tente de novo em alguns segundos. ⏳";
export const BUSY_MESSAGE = "Muita gente usando a demo agora. Espere 1 minutinho e tente de novo. ⏳";
export const GENERIC_ERROR = "Ops, algo deu errado ao falar com a IA. Tente de novo.";

export function defaultModels(): string[] {
  const primary = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const fallback = process.env.GEMINI_FALLBACK_MODEL ?? "gemini-3.5-flash";
  return fallback && fallback !== primary ? [primary, fallback] : [primary];
}

export function errorStatus(error: unknown): number | undefined {
  const e = error as { status?: unknown; name?: unknown; message?: unknown } | null;
  if (typeof e?.status === "number") return e.status;
  const msg = typeof e?.message === "string" ? e.message : "";
  if (msg.includes("RESOURCE_EXHAUSTED")) return 429;
  if (msg.includes("UNAVAILABLE") || e?.name === "TimeoutError" || e?.name === "AbortError") return 503;
  return undefined;
}

/** 503/500/504/timeout e 429 (as cotas do free tier são por modelo) justificam tentar outro modelo. */
export const isRetryable = (status?: number) => status === 503 || status === 500 || status === 504 || status === 429;

function isPerMinuteLimit(error: unknown): boolean {
  const msg = String((error as { message?: unknown } | null)?.message ?? "");
  return /PerMinute|retry in \d/i.test(msg);
}

export function friendlyError(error: unknown): string {
  const status = errorStatus(error);
  if (status === 429) return isPerMinuteLimit(error) ? BUSY_MESSAGE : QUOTA_MESSAGE;
  return isRetryable(status) ? OVERLOAD_MESSAGE : GENERIC_ERROR;
}

/**
 * Chama `fn` com o modelo atual; se o modelo estiver indisponível (503/500/504/timeout),
 * passa para o próximo da lista. `cursor.index` guarda o modelo em uso entre chamadas.
 */
export async function withModelFallback<T>(
  models: string[],
  fn: (model: string) => Promise<T>,
  cursor: { index: number } = { index: 0 },
): Promise<T> {
  while (true) {
    try {
      return await fn(models[cursor.index]);
    } catch (error) {
      if (isRetryable(errorStatus(error)) && cursor.index < models.length - 1) {
        console.warn(`[ia] ${models[cursor.index]} indisponível, tentando ${models[cursor.index + 1]}`);
        cursor.index++;
        continue;
      }
      throw error;
    }
  }
}

export function getGenAIModels() {
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { timeout: 25_000, retryOptions: { attempts: 2, initialDelay: 0.5, maxDelay: 2 } },
  });
  return ai.models;
}
