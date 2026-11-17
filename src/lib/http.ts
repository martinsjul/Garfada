export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "anon";
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export function tooMany(retryAfterSec: number, error = "Muitas mensagens. Tente de novo em alguns minutos.") {
  return Response.json({ error }, { status: 429, headers: { "Retry-After": String(retryAfterSec) } });
}
