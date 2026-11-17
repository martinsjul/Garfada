import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { GENERIC_ERROR, MAX_STEPS, OVERLOAD_MESSAGE, QUOTA_MESSAGE, runAgent, type AgentClient, type ModelResponse } from "./runAgent";
import { CATALOG } from "@/data/catalog";
import { EMPTY_CART, EMPTY_PREFS, type StreamEvent } from "../types";

const call = (name: string, args: Record<string, unknown>): ModelResponse => ({
  functionCalls: [{ name, args, id: `id-${name}` }],
  candidates: [{ content: { role: "model", parts: [{ functionCall: { name, args } }] } }],
});
const text = (t: string): ModelResponse => ({ text: t, candidates: [{ content: { role: "model", parts: [{ text: t }] } }] });

function scripted(responses: (ModelResponse | Error | Record<string, unknown>)[]) {
  const requests: { model: string; contents: unknown[] }[] = [];
  const client: AgentClient = {
    async generateContent(req) {
      const r = req as { model: string; contents: unknown[] };
      requests.push({ model: r.model, contents: structuredClone(r.contents) });
      const next = responses.shift();
      if (!next) throw new Error("sem mais respostas");
      if (next instanceof Error || ("status" in next && !("candidates" in next))) throw next;
      return next as ModelResponse;
    },
  };
  return { client, requests };
}

async function collect(gen: AsyncGenerator<StreamEvent>) {
  const out: StreamEvent[] = [];
  for await (const e of gen) out.push(e);
  return out;
}

const input = (text = "quero feijoada") => ({
  messages: [{ role: "user" as const, text }],
  state: { prefs: EMPTY_PREFS, cart: EMPTY_CART, recent: [] },
  catalog: CATALOG,
});

describe("runAgent", () => {
  it("executa ferramentas, emite passos, pratos, estado e resposta final", async () => {
    const { client, requests } = scripted([
      call("salvar_preferencia", { tipo: "dieta", valor: "vegano" }),
      call("buscar_pratos", { texto: "feijoada" }),
      text("Achei a **Feijoada Vegana** do Raiz."),
    ]);
    const events = await collect(runAgent(client, input("sou vegana, quero feijoada"), { models: ["m1"] }));
    expect(events.map((e) => e.type)).toEqual(["tool", "state", "tool", "dishes", "state", "text", "done"]);
    const dishes = events.find((e) => e.type === "dishes");
    expect(dishes?.type === "dishes" && dishes.dishes.map((d) => d.nome)).toEqual(["Feijoada Vegana"]);
    const state = events.findLast((e) => e.type === "state");
    expect(state?.type === "state" && state.state.prefs.dieta).toEqual(["vegano"]);
    expect(state?.type === "state" && state.state.recent).toEqual(["raiz-vegana-3"]);
    // o resultado da ferramenta volta para o modelo como functionResponse
    const last = requests[2].contents.at(-1) as { role: string; parts: { functionResponse: { name: string } }[] };
    expect(last.role).toBe("user");
    expect(last.parts[0].functionResponse.name).toBe("buscar_pratos");
  });

  it("para depois de MAX_STEPS chamadas de ferramenta", async () => {
    const { client } = scripted(Array.from({ length: MAX_STEPS + 2 }, () => call("ver_carrinho", {})));
    const events = await collect(runAgent(client, input(), { models: ["m1"] }));
    expect(events.filter((e) => e.type === "tool")).toHaveLength(MAX_STEPS);
    expect(events.at(-2)).toEqual({ type: "text", text: expect.stringContaining("reformular") });
    expect(events.at(-1)).toEqual({ type: "done" });
  });

  it("troca para o modelo reserva quando o principal está sobrecarregado (503)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { client, requests } = scripted([{ status: 503, message: "UNAVAILABLE" }, text("Oi!")]);
    const events = await collect(runAgent(client, input(), { models: ["principal", "reserva"] }));
    expect(requests.map((r) => r.model)).toEqual(["principal", "reserva"]);
    expect(events).toEqual([{ type: "text", text: "Oi!" }, { type: "done" }]);
  });

  it("todos os modelos sobrecarregados → mensagem amigável", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = scripted([{ status: 503 }, { status: 503 }]);
    expect(await collect(runAgent(client, input(), { models: ["a", "b"] }))).toEqual([{ type: "error", message: OVERLOAD_MESSAGE }]);
  });

  it("429 em todos os modelos → mensagem de cota", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { client } = scripted([{ status: 429, message: "RESOURCE_EXHAUSTED" }, { status: 429, message: "RESOURCE_EXHAUSTED" }]);
    expect(await collect(runAgent(client, input(), { models: ["a", "b"] }))).toEqual([{ type: "error", message: QUOTA_MESSAGE }]);
  });

  it("outros erros → mensagem genérica", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = scripted([new Error("boom")]);
    expect(await collect(runAgent(client, input(), { models: ["a"] }))).toEqual([{ type: "error", message: GENERIC_ERROR }]);
  });

  it("resposta vazia do modelo vira uma frase de fallback", async () => {
    const { client } = scripted([{ candidates: [{ content: { role: "model", parts: [] } }] }]);
    const events = await collect(runAgent(client, input(), { models: ["a"] }));
    expect(events[0]).toEqual({ type: "text", text: expect.any(String) });
    expect((events[0] as { text: string }).text.length).toBeGreaterThan(5);
  });
});
