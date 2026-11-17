import "server-only";
import {
  defaultModels,
  friendlyError,
  getGenAIModels,
  withModelFallback,
} from "../ai/models";
import { buildSystemPrompt } from "./prompt";
import { executeTool, TOOL_DECLARATIONS } from "./tools";
import type { AgentState, ChatMessage, Restaurant, StreamEvent } from "../types";

export const MAX_STEPS = 6;
export { GENERIC_ERROR, OVERLOAD_MESSAGE, QUOTA_MESSAGE } from "../ai/models";
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

export async function* runAgent(
  client: AgentClient,
  input: AgentInput,
  opts: { models?: string[]; signal?: AbortSignal } = {},
): AsyncGenerator<StreamEvent> {
  const models = opts.models ?? defaultModels();
  let state = input.state;
  const contents: Content[] = input.messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.text }],
  }));

  const cursor = { index: 0 };
  const generate = () =>
    withModelFallback(
      models,
      (model) =>
        client.generateContent({
          model,
          contents,
          config: {
            systemInstruction: buildSystemPrompt(state),
            tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
            temperature: 0.3,
            ...(opts.signal && { abortSignal: opts.signal }),
          },
        }),
      cursor,
    );

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
    yield { type: "error", message: friendlyError(error) };
  }
}

export function getAgentClient(): AgentClient {
  return getGenAIModels() as unknown as AgentClient;
}
