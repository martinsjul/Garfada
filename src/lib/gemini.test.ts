import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildRequest, GENERIC_ERROR, QUOTA_MESSAGE, streamChat, type GenAIStreamClient } from "./gemini";
import { SYSTEM_PROMPT } from "./systemPrompt";
import type { ChatMessage, StreamEvent } from "./types";

type Chunk = { text?: string; candidates?: { groundingMetadata?: unknown }[] };

function fakeClient(chunks: Chunk[], failAfter?: { index: number; error: unknown }): GenAIStreamClient {
  return {
    async generateContentStream() {
      return (async function* () {
        for (let i = 0; i < chunks.length; i++) {
          if (failAfter && i === failAfter.index) throw failAfter.error;
          yield chunks[i];
        }
        if (failAfter && failAfter.index >= chunks.length) throw failAfter.error;
      })();
    },
  };
}

async function collect(gen: AsyncGenerator<StreamEvent>) {
  const events: StreamEvent[] = [];
  for await (const e of gen) events.push(e);
  return events;
}

const user = (text: string): ChatMessage => ({ role: "user", text });
const maps = (title: string, id: string) => ({ maps: { title, uri: `https://maps.google.com/?cid=${id}`, placeId: `places/${id}` } });

describe("buildRequest", () => {
  it("usa a tool googleMaps e as últimas 10 mensagens", () => {
    const messages: ChatMessage[] = Array.from({ length: 12 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      text: `m${i}`,
    }));
    const req = buildRequest(messages);
    expect(req.contents).toHaveLength(10);
    expect(req.contents[0]).toEqual({ role: "user", parts: [{ text: "m2" }] });
    expect(req.contents[1].role).toBe("model");
    expect(req.config.tools).toEqual([{ googleMaps: {} }]);
    expect(req.config.systemInstruction).toBe(SYSTEM_PROMPT);
  });

  it("inclui latLng quando há localização", () => {
    const req = buildRequest([user("oi")], { latitude: -23.5, longitude: -46.6 });
    expect((req.config as { toolConfig?: { retrievalConfig: { latLng: unknown } } }).toolConfig?.retrievalConfig.latLng).toEqual({ latitude: -23.5, longitude: -46.6 });
    expect((buildRequest([user("oi")]).config as { toolConfig?: unknown }).toolConfig).toBeUndefined();
  });
});

describe("streamChat", () => {
  it("emite text, depois places, depois done", async () => {
    const client = fakeClient([
      { text: "Achei " },
      { text: "2 lugares", candidates: [{ groundingMetadata: { groundingChunks: [maps("A", "1"), maps("B", "2")] } }] },
    ]);
    const events = await collect(streamChat(client, [user("pizza")]));
    expect(events.map((e) => e.type)).toEqual(["text", "text", "places", "done"]);
    const places = events.find((e) => e.type === "places");
    expect(places).toMatchObject({ places: [{ name: "A" }, { name: "B" }] });
  });

  it("junta groundingChunks espalhados em vários chunks do stream", async () => {
    const client = fakeClient([
      { text: "a", candidates: [{ groundingMetadata: { groundingChunks: [maps("A", "1")] } }] },
      { text: "b", candidates: [{ groundingMetadata: { groundingSupports: [{ groundingChunkIndices: [0] }] } }] },
      { text: "c", candidates: [{ groundingMetadata: { groundingChunks: [maps("B", "2"), maps("A", "1")] } }] },
    ]);
    const events = await collect(streamChat(client, [user("pizza")]));
    expect(events.find((e) => e.type === "places")).toMatchObject({ places: [{ name: "A" }, { name: "B" }] });
  });

  it("sem grounding emite text e done, sem evento places", async () => {
    const events = await collect(streamChat(fakeClient([{ text: "Em qual cidade?" }]), [user("comida")]));
    expect(events).toEqual([{ type: "text", text: "Em qual cidade?" }, { type: "done" }]);
  });

  it("converte 429/RESOURCE_EXHAUSTED em error com QUOTA_MESSAGE", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const client = fakeClient([{ text: "Achei" }], { index: 1, error: { status: 429, message: "RESOURCE_EXHAUSTED" } });
    const events = await collect(streamChat(client, [user("pizza")]));
    expect(events).toEqual([{ type: "text", text: "Achei" }, { type: "error", message: QUOTA_MESSAGE }]);

    const byMessage = fakeClient([], { index: 0, error: new Error("got status: RESOURCE_EXHAUSTED") });
    expect(await collect(streamChat(byMessage, [user("x")]))).toEqual([{ type: "error", message: QUOTA_MESSAGE }]);
  });

  it("converte outros erros em GENERIC_ERROR", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const client = fakeClient([], { index: 0, error: new Error("boom") });
    expect(await collect(streamChat(client, [user("x")]))).toEqual([{ type: "error", message: GENERIC_ERROR }]);
  });
});
