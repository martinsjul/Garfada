import { sanitizeRestaurant } from "./validate";
import type { Restaurant } from "./types";

const KEY = "garfada:restaurantes";

/** Restaurantes publicados pelo copiloto ficam só neste navegador. */
export function loadImported(): Restaurant[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.map(sanitizeRestaurant).filter((r): r is Restaurant => r !== null) : [];
  } catch {
    return [];
  }
}

export function saveImported(list: Restaurant[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}
