import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const extractMenu = vi.fn();
vi.mock("@/lib/menu/extract", () => ({
  extractMenu: (...args: unknown[]) => extractMenu(...args),
  getMenuClient: () => ({ fake: true }),
}));

import { POST } from "./route";

const draft = { restaurante: { nome: "X", culinaria: "y" }, itens: [{ nome: "A", descricao: "", descricaoOriginal: "", preco: 10, categoria: "c", tags: [] }], combos: [] };
const PNG = "data:image/png;base64,iVBORw0KGgo=";

function request(body: unknown, ip = "9.9.9.1") {
  return new Request("http://localhost/api/menu", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

describe("POST /api/menu", () => {
  beforeEach(() => extractMenu.mockReset());

  it("extrai o cardápio de uma imagem válida", async () => {
    extractMenu.mockResolvedValueOnce(draft);
    const res = await POST(request({ image: PNG }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ draft });
    expect(extractMenu.mock.calls[0][1]).toEqual({ data: "iVBORw0KGgo=", mimeType: "image/png" });
  });

  it.each([{}, { image: "http://x.com/a.png" }, { image: "data:image/gif;base64,R0lG" }, { image: "data:image/png;base64,@@@" }])(
    "rejeita imagem inválida (%j)",
    async (body) => {
      const res = await POST(request(body, "9.9.9.2"));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Envie uma imagem JPG, PNG ou WEBP." });
    },
  );

  it("imagem grande demais → 413", async () => {
    const res = await POST(request({ image: `data:image/jpeg;base64,${"A".repeat(4_500_001)}` }, "9.9.9.3"));
    expect(res.status).toBe(413);
  });

  it("nenhum item encontrado → 422 com dica", async () => {
    extractMenu.mockResolvedValueOnce({ ...draft, itens: [] });
    const res = await POST(request({ image: PNG }, "9.9.9.4"));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/foto mais nítida/);
  });

  it("cota esgotada → 429 com mensagem amigável", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    extractMenu.mockRejectedValueOnce({ status: 429 });
    const res = await POST(request({ image: PNG }, "9.9.9.5"));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatch(/limite gratuito/);
  });

  it("limita a 8 extrações por hora por IP", async () => {
    extractMenu.mockResolvedValue(draft);
    for (let i = 0; i < 8; i++) expect((await POST(request({ image: PNG }, "9.9.9.6"))).status).toBe(200);
    expect((await POST(request({ image: PNG }, "9.9.9.6"))).status).toBe(429);
  });
});
