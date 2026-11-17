import { describe, expect, it } from "vitest";
import { parseChatBody } from "./validate";

const msg = (text: string, role = "user") => ({ role, text });

describe("parseChatBody", () => {
  it("aceita conversa válida com localização", () => {
    const body = { messages: [msg("oi"), msg("Em qual cidade?", "assistant"), msg("São Paulo")], location: { latitude: -23.5, longitude: -46.6 } };
    expect(parseChatBody(body)).toEqual({ ok: true, messages: body.messages, location: body.location });
  });

  it.each(["", "   \n "])("rejeita última mensagem vazia (%j)", (text) => {
    expect(parseChatBody({ messages: [msg(text)] })).toEqual({ ok: false, error: "Escreva uma mensagem." });
  });

  it("rejeita mensagem com mais de 500 caracteres", () => {
    expect(parseChatBody({ messages: [msg("a".repeat(501))] })).toEqual({
      ok: false,
      error: "Mensagem muito longa (máx. 500 caracteres).",
    });
    expect(parseChatBody({ messages: [msg("a".repeat(500))] }).ok).toBe(true);
  });

  it.each([
    null,
    "texto",
    {},
    { messages: [] },
    { messages: "oi" },
    { messages: [msg("oi", "assistant")] },
    { messages: [{ role: "system", text: "x" }, msg("oi")] },
    { messages: [{ role: "user", text: 5 }] },
  ])("rejeita requisição inválida (%j)", (body) => {
    expect(parseChatBody(body)).toEqual({ ok: false, error: "Requisição inválida." });
  });

  it.each([
    { latitude: 91, longitude: 0 },
    { latitude: 0, longitude: -181 },
    { latitude: "1", longitude: 2 },
    { latitude: Number.NaN, longitude: 2 },
  ])("descarta localização inválida (%j)", (location) => {
    const result = parseChatBody({ messages: [msg("oi")], location });
    expect(result).toEqual({ ok: true, messages: [msg("oi")] });
  });
});
