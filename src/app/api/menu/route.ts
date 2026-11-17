import { defaultModels, errorStatus, friendlyError } from "@/lib/ai/models";
import { clientIp, readJson, tooMany } from "@/lib/http";
import { extractMenu, getMenuClient } from "@/lib/menu/extract";
import { menuLimiter } from "@/lib/rateLimit";

const MAX_DATA_URL = 4_500_000; // ~3,3 MB de imagem; o cliente redimensiona antes de enviar
const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  const body = (await readJson(request)) as { image?: unknown } | undefined;
  const image = typeof body?.image === "string" ? body.image : "";

  if (image.length > MAX_DATA_URL) {
    return Response.json({ error: "Imagem grande demais. Use uma foto de até 3 MB." }, { status: 413 });
  }
  const match = DATA_URL.exec(image);
  if (!match) return Response.json({ error: "Envie uma imagem JPG, PNG ou WEBP." }, { status: 400 });

  const limit = menuLimiter.check(clientIp(request));
  if (!limit.ok) return tooMany(limit.retryAfterSec, "Muitas leituras de cardápio. Tente de novo mais tarde.");

  try {
    const draft = await extractMenu(getMenuClient(), { data: match[2], mimeType: match[1] }, defaultModels());
    if (draft.itens.length === 0) {
      return Response.json(
        { error: "Não encontrei itens com preço nessa imagem. Tente uma foto mais nítida, de frente e com boa luz." },
        { status: 422 },
      );
    }
    return Response.json({ draft });
  } catch (error) {
    console.error("[cardapio] erro:", error);
    const status = errorStatus(error) === 429 ? 429 : 503;
    return Response.json({ error: friendlyError(error) }, { status });
  }
}
