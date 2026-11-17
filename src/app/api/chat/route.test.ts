import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StreamEvent } from "@/lib/types";

const events: StreamEvent[] = [
  { type: "tool", step: { name: "buscar_pratos", args: { texto: "pizza" }, resumo: "1 prato(s) encontrado(s)" } },
  { type: "text", text: "Achei!" },
  { type: "done" },
];

const runAgent = vi.fn(async function* (..._args: unknown[]) {
  yield* events;
});

vi.mock("@/lib/agent/runAgent", () => ({
  runAgent: (...args: unknown[]) => runAgent(...args),
  getAgentClient: () => ({ fake: true }),
}));

import { POST } from "./route";
import { CATALOG } from "@/data/catalog";

function request(body: unknown, ip = "1.1.1.1") {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `${ip}, 10.0.0.1` },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const valid = { messages: [{ role: "user", text: "pizza" }] };

describe("POST /api/chat", () => {
  beforeEach(() => runAgent.mockClear());

  it("body inválido responde 400 com erro em pt-BR", async () => {
    const res = await POST(request({ messages: [] }, "2.2.2.2"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Requisição inválida." });
  });

  it("JSON malformado responde 400", async () => {
    expect((await POST(request("{nope", "2.2.2.3"))).status).toBe(400);
  });

  it("a 21ª chamada do mesmo IP responde 429 com Retry-After", async () => {
    for (let i = 0; i < 20; i++) await (await POST(request(valid, "3.3.3.3"))).text();
    const res = await POST(request(valid, "3.3.3.3"));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "Muitas mensagens. Tente de novo em alguns minutos." });
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  it("caminho feliz: NDJSON com os eventos do agente e catálogo com os importados", async () => {
    const imported = { id: "imp-teste", nome: "Teste", culinaria: "x", bairro: "y", tempoEntregaMin: 30, taxaEntrega: 0, nota: 0, rodizio: false, itens: [] };
    const res = await POST(request({ ...valid, restaurantes: [imported] }, "4.4.4.4"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");
    const lines = (await res.text()).trim().split("\n").map((l) => JSON.parse(l));
    expect(lines).toEqual(events);
    const [client, input] = runAgent.mock.calls[0] as [unknown, { catalog: { id: string }[]; messages: unknown }];
    expect(client).toEqual({ fake: true });
    expect(input.messages).toEqual(valid.messages);
    expect(input.catalog).toHaveLength(CATALOG.length + 1);
    expect(input.catalog.at(-1)?.id).toBe("imp-teste");
  });
});
