import { describe, expect, it } from "vitest";
import { readEvents } from "./readEvents";

function streamOf(...parts: string[]) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(c) {
      parts.forEach((p) => c.enqueue(encoder.encode(p)));
      c.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>) {
  const out = [];
  for await (const e of readEvents(stream)) out.push(e);
  return out;
}

describe("readEvents", () => {
  it("junta linhas quebradas entre chunks", async () => {
    const events = await collect(streamOf('{"type":"te', 'xt","text":"oi"}\n{"type":"done"}\n'));
    expect(events).toEqual([{ type: "text", text: "oi" }, { type: "done" }]);
  });

  it("ignora linhas vazias e aceita última linha sem \\n", async () => {
    const events = await collect(streamOf('\n{"type":"text","text":"a"}\n\n', '{"type":"done"}'));
    expect(events).toEqual([{ type: "text", text: "a" }, { type: "done" }]);
  });
});
