import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StreamEvent } from "@/lib/types";

const events: StreamEvent[] = [
  { type: "text", text: "Achei" },
  { type: "places", places: [{ id: "p1", name: "A", mapsUrl: "https://maps.google.com/?cid=1" }] },
  { type: "done" },
];

const streamChat = vi.fn(async function* () {
  yield* events;
});

vi.mock("@/lib/gemini", () => ({
  streamChat: (...args: unknown[]) => streamChat(...(args as [])),
  getDefaultClient: () => ({}),
}));

import { POST } from "./route";

function request(body: unknown, ip = "1.1.1.1") {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `${ip}, 10.0.0.1` },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const valid = { messages: [{ role: "user", text: "rodízio de pizza" }] };

describe("POST /api/chat", () => {
  beforeEach(() => streamChat.mockClear());

  it("body inválido responde 400 com erro em pt-BR", async () => {
    const res = await POST(request({ messages: [] }, "2.2.2.2"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Requisição inválida." });
  });

  it("JSON malformado responde 400", async () => {
    const res = await POST(request("{nope", "2.2.2.3"));
    expect(res.status).toBe(400);
  });

  it("a 21ª chamada do mesmo IP responde 429 com Retry-After", async () => {
    for (let i = 0; i < 20; i++) {
      const ok = await POST(request(valid, "3.3.3.3"));
      expect(ok.status).toBe(200);
      await ok.text();
    }
    const res = await POST(request(valid, "3.3.3.3"));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "Muitas mensagens. Tente de novo em alguns minutos." });
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  it("caminho feliz responde NDJSON com os eventos do streamChat", async () => {
    const res = await POST(request({ ...valid, location: { latitude: 1, longitude: 2 } }, "4.4.4.4"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");
    const lines = (await res.text()).trim().split("\n").map((l) => JSON.parse(l));
    expect(lines).toEqual(events);
    expect(streamChat).toHaveBeenCalledWith({}, valid.messages, { latitude: 1, longitude: 2 });
  });
});
