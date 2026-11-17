import { getDefaultClient, streamChat } from "@/lib/gemini";
import { chatLimiter } from "@/lib/rateLimit";
import { parseChatBody } from "@/lib/validate";

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "anon";
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const parsed = parseChatBody(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const limit = chatLimiter.check(clientIp(request));
  if (!limit.ok) {
    return Response.json(
      { error: "Muitas mensagens. Tente de novo em alguns minutos." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  const encoder = new TextEncoder();
  const events = streamChat(getDefaultClient(), parsed.messages, parsed.location);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of events) {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        }
      } finally {
        controller.close();
      }
    },
    async cancel() {
      await events.return(undefined);
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
