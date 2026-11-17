import "server-only";
import { GoogleGenAI } from "@google/genai";
import { buildSystemPrompt } from "./prompt";
import { executeTool, TOOL_DECLARATIONS } from "./tools";
import type { AgentState, ChatMessage, Restaurant, StreamEvent } from "../types";

export const MAX_STEPS = 6;
export const QUOTA_MESSAGE = "A demo atingiu o limite gratuito de hoje. Volte amanhã! 🙏";
export const OVERLOAD_MESSAGE = "A IA está sobrecarregada agora. Tente de novo em alguns segundos. ⏳";
export const GENERIC_ERROR = "Ops, algo deu errado ao falar com a IA. Tente de novo.";
const STEP_LIMIT_TEXT = "Fiz várias buscas e não cheguei a uma resposta boa. Pode reformular o pedido com mais detalhes?";
const EMPTY_TEXT = "Hmm, não consegui responder dessa vez. Pode reformular o pedido?";

type Content = { role: string; parts: Record<string, unknown>[] };

export interface ModelResponse {
  text?: string;
  functionCalls?: { name?: string; args?: Record<string, unknown>; id?: string }[];
  candidates?: { content?: Content }[];
}

export interface AgentClient {
  generateContent(req: unknown): Promise<ModelResponse>;
}

export interface AgentInput {
  messages: ChatMessage[];
  state: AgentState;
  catalog: Restaurant[];
}

export function defaultModels(): string[] {
  const primary = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const fallback = process.env.GEMINI_FALLBACK_MODEL ?? "gemini-3.5-flash";
  return fallback && fallback !== primary ? [primary, fallback] : [primary];
}

function errorStatus(error: unknown): number | undefined {
  const e = error as { status?: unknown; name?: unknown; message?: unknown } | null;
  if (typeof e?.status === "number") return e.status;
  const msg = typeof e?.message === "string" ? e.message : "";
  if (msg.includes("RESOURCE_EXHAUSTED")) return 429;
  if (msg.includes("UNAVAILABLE") || e?.name === "TimeoutError" || e?.name === "AbortError") return 503;
  return undefined;
}

const isRetryable = (status?: number) => status === 503 || status === 500 || status === 504;

export async function* runAgent(
  client: AgentClient,
  input: AgentInput,
  opts: { models?: string[]; signal?: AbortSignal } = {},
): AsyncGenerator<StreamEvent> {
  const models = opts.models ?? defaultModels();
  let modelIndex = 0;
  let state = input.state;
  const contents: Content[] = input.messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.text }],
  }));

  async function generate(): Promise<ModelResponse> {
    while (true) {
      try {
        return await client.generateContent({
          model: models[modelIndex],
          contents,
          config: {
            systemInstruction: buildSystemPrompt(state),
            tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
            temperature: 0.3,
            ...(opts.signal && { abortSignal: opts.signal }),
          },
        });
      } catch (error) {
        if (isRetryable(errorStatus(error)) && modelIndex < models.length - 1) {
          console.warn(`[agente] ${models[modelIndex]} indisponível, tentando ${models[modelIndex + 1]}`);
          modelIndex++;
          continue;
        }
        throw error;
      }
    }
  }

  try {
    for (let step = 0; step <= MAX_STEPS; step++) {
      const response = await generate();
      const calls = (response.functionCalls ?? []).filter((c) => c.name);

      if (calls.length === 0) {
        yield { type: "text", text: response.text?.trim() || EMPTY_TEXT };
        yield { type: "done" };
        return;
      }
      if (step === MAX_STEPS) break;

      contents.push(response.candidates?.[0]?.content ?? { role: "model", parts: calls.map((c) => ({ functionCall: c })) });
      const responses: Record<string, unknown>[] = [];

      for (const c of calls) {
        const before = state;
        const out = executeTool(c.name!, c.args ?? {}, { catalog: input.catalog, state });
        state = out.state;
        yield { type: "tool", step: out.step };
        if (out.dishes?.length) yield { type: "dishes", dishes: out.dishes };
        if (state !== before) yield { type: "state", state };
        responses.push({ functionResponse: { name: c.name, ...(c.id && { id: c.id }), response: out.response } });
      }
      contents.push({ role: "user", parts: responses });
    }

    yield { type: "text", text: STEP_LIMIT_TEXT };
    yield { type: "done" };
  } catch (error) {
    console.error("[agente] erro:", error);
    const status = errorStatus(error);
    yield { type: "error", message: status === 429 ? QUOTA_MESSAGE : isRetryable(status) ? OVERLOAD_MESSAGE : GENERIC_ERROR };
  }
}

export function getAgentClient(): AgentClient {
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { timeout: 20_000, retryOptions: { attempts: 2, initialDelay: 0.5, maxDelay: 2 } },
  });
  return ai.models as unknown as AgentClient;
}
