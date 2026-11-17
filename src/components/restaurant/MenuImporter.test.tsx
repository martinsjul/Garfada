import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/image", () => ({ resizeImage: vi.fn(async () => "data:image/jpeg;base64,QUJD") }));

import MenuImporter from "./MenuImporter";

const draft = {
  restaurante: { nome: "Boteco do Seu Lima", culinaria: "boteco" },
  itens: [
    { nome: "Pastel de Queijo", descricao: "Pastéis crocantes", descricaoOriginal: "6 un.", preco: 24, categoria: "petiscos", tags: ["vegetariano"] },
    { nome: "Torresmo", descricao: "Crocante", descricaoOriginal: "", preco: 29, categoria: "petiscos", tags: [] },
  ],
  combos: [{ nome: "Combo Boteco", itens: ["Pastel de Queijo", "Torresmo"], precoSugerido: 48, motivo: "pra dividir" }],
};

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  localStorage.clear();
  fetchMock = vi.fn(async () => Response.json({ draft }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

async function readSample() {
  render(<MenuImporter />);
  await userEvent.click(screen.getByRole("button", { name: /Boteco do Seu Lima/ }));
  return screen.findByRole("table");
}

describe("MenuImporter", () => {
  it("lê um cardápio de exemplo e mostra os itens para revisão", async () => {
    const table = await readSample();
    expect(fetchMock).toHaveBeenCalledWith("/api/menu", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ image: "data:image/jpeg;base64,QUJD" });
    expect(within(table).getByDisplayValue("Pastel de Queijo")).toBeInTheDocument();
    expect(within(table).getByDisplayValue("24")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Boteco do Seu Lima")).toBeInTheDocument();
    expect(screen.getByText("Combo Boteco")).toBeInTheDocument();
  });

  it("permite editar, remover itens, adicionar combo e publicar no navegador", async () => {
    const table = await readSample();
    const price = within(table).getByDisplayValue("24");
    await userEvent.clear(price);
    await userEvent.type(price, "26.5");
    await userEvent.click(within(table).getByRole("button", { name: "Remover Torresmo" }));
    await userEvent.click(screen.getByRole("button", { name: "Adicionar Combo Boteco ao cardápio" }));
    await userEvent.type(screen.getByLabelText("Bairro"), "Lapa");
    await userEvent.click(screen.getByRole("button", { name: "Publicar no catálogo" }));

    const saved = JSON.parse(localStorage.getItem("garfada:restaurantes")!);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ nome: "Boteco do Seu Lima", bairro: "Lapa", origem: "importado" });
    expect(saved[0].itens.map((i: { nome: string; preco: number }) => [i.nome, i.preco])).toEqual([["Pastel de Queijo", 26.5], ["Combo Boteco", 48]]);
    expect(screen.getByRole("status")).toHaveTextContent(/publicado/);
    expect(screen.getByRole("link", { name: /Testar no chat/ })).toHaveAttribute("href", "/");
    expect(screen.getByRole("list", { name: "Restaurantes publicados" })).toHaveTextContent("Boteco do Seu Lima");
  });

  it("não publica sem nome ou sem itens", async () => {
    const table = await readSample();
    await userEvent.clear(screen.getByLabelText("Nome do restaurante"));
    await userEvent.click(screen.getByRole("button", { name: "Publicar no catálogo" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/nome do restaurante/);
    expect(localStorage.getItem("garfada:restaurantes")).toBeNull();
    expect(table).toBeInTheDocument();
  });

  it("mostra o erro da API quando a leitura falha", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: "Não encontrei itens com preço nessa imagem." }, { status: 422 }));
    render(<MenuImporter />);
    await userEvent.click(screen.getByRole("button", { name: /Padaria Flor de Lis/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não encontrei itens com preço nessa imagem.");
  });

  it("remover um restaurante publicado", async () => {
    await readSample();
    await userEvent.click(screen.getByRole("button", { name: "Publicar no catálogo" }));
    const list = screen.getByRole("list", { name: "Restaurantes publicados" });
    await userEvent.click(within(list).getByRole("button", { name: /Remover Boteco/ }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem("garfada:restaurantes")!)).toEqual([]));
  });
});
