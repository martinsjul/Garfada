import { CATALOG } from "@/data/catalog";
import { getAgentClient, runAgent } from "@/lib/agent/runAgent";
import { clientIp, readJson, tooMany } from "@/lib/http";
import { chatLimiter } from "@/lib/rateLimit";
import { parseChatBody } from "@/lib/validate";

export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  const body = await readJson(request);
  if (body === undefined) return Response.json({ error: "Requisição inválida." }, { status: 400 });

  const parsed = parseChatBody(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const limit = chatLimiter.check(clientIp(request));
  if (!limit.ok) return tooMany(limit.retryAfterSec);

  const encoder = new TextEncoder();
  const events = runAgent(
    getAgentClient(),
    { messages: parsed.messages, state: parsed.state, catalog: [...CATALOG, ...parsed.imported] },
    { signal: request.signal },
  );

  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of events) {
          if (cancelled) break;
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        }
      } finally {
        if (!cancelled) controller.close();
      }
    },
    cancel() {
      cancelled = true;
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
