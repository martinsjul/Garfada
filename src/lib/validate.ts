import type { ChatMessage, LatLng } from "./types";

import { MAX_MESSAGE_LENGTH } from "./limits";
export { MAX_MESSAGE_LENGTH };
const MAX_ASSISTANT_LENGTH = 8000;
const MAX_HISTORY = 10;

type ParseResult = { ok: true; messages: ChatMessage[]; location?: LatLng } | { ok: false; error: string };

const INVALID: ParseResult = { ok: false, error: "Requisição inválida." };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMessage(value: unknown): value is ChatMessage {
  if (!isRecord(value) || typeof value.text !== "string") return false;
  if (value.role === "user") return value.text.length <= MAX_MESSAGE_LENGTH;
  if (value.role === "assistant") return value.text.length <= MAX_ASSISTANT_LENGTH;
  return false;
}

function parseLocation(value: unknown): LatLng | undefined {
  if (!isRecord(value)) return undefined;
  const { latitude, longitude } = value;
  if (typeof latitude !== "number" || typeof longitude !== "number") return undefined;
  if (!(Math.abs(latitude) <= 90) || !(Math.abs(longitude) <= 180)) return undefined;
  return { latitude, longitude };
}

export function parseChatBody(body: unknown): ParseResult {
  if (!isRecord(body) || !Array.isArray(body.messages) || body.messages.length === 0) return INVALID;

  // O servidor só usa as últimas mensagens; valida apenas essas.
  const recent: unknown[] = body.messages.slice(-MAX_HISTORY);
  const last = recent[recent.length - 1];

  if (isRecord(last) && last.role === "user" && typeof last.text === "string") {
    if (last.text.trim() === "") return { ok: false, error: "Escreva uma mensagem." };
    if (last.text.length > MAX_MESSAGE_LENGTH) {
      return { ok: false, error: `Mensagem muito longa (máx. ${MAX_MESSAGE_LENGTH} caracteres).` };
    }
  } else {
    return INVALID;
  }

  if (!recent.every(isMessage)) return INVALID;
  const messages = recent as ChatMessage[];
  const location = parseLocation(body.location);
  return location ? { ok: true, messages, location } : { ok: true, messages };
}
