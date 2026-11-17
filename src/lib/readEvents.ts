import type { StreamEvent } from "./types";

/** Lê uma resposta NDJSON e devolve um evento por linha. */
export async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) yield JSON.parse(line) as StreamEvent;
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) yield JSON.parse(buffer) as StreamEvent;
  } finally {
    reader.releaseLock();
  }
}
