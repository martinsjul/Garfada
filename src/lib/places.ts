import type { Place } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

/** Extrai os lugares do Google Maps a partir do groundingMetadata do Gemini. */
export function extractPlaces(metadata: unknown): Place[] {
  if (!isRecord(metadata) || !Array.isArray(metadata.groundingChunks)) return [];

  const places: Place[] = [];
  const seen = new Set<string>();

  for (const chunk of metadata.groundingChunks) {
    if (!isRecord(chunk) || !isRecord(chunk.maps)) continue;
    const { title, uri, placeId } = chunk.maps;
    if (typeof title !== "string" || typeof uri !== "string" || !isHttpUrl(uri)) continue;

    const id = typeof placeId === "string" && placeId ? placeId : uri;
    if (seen.has(id)) continue;
    seen.add(id);
    places.push({ id, name: title, mapsUrl: uri });
  }

  return places;
}
