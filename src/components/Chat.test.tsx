import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Chat from "./Chat";
import type { DishResult, StreamEvent } from "@/lib/types";

const QUOTA = "A demo atingiu o limite gratuito de hoje. Volte amanhã! 🙏";

function ndjson(events: StreamEvent[]) {
  return new Response(events.map((e) => JSON.stringify(e)).join("\n") + "\n", { headers: { "content-type": "application/x-ndjson" } });
}

const bolo: DishResult = {
  itemId: "cafe-do-largo-3", nome: "Bolo de Cenoura com Chocolate", descricao: "fatia generosa", preco: 15, categoria: "bolos", tags: ["vegetariano"],
  restaurante: { id: "cafe-do-largo", nome: "Café do Largo", bairro: "Centro", tempoEntregaMin: 20, taxaEntrega: 3.9, nota: 4.6 },
};

const happy: StreamEvent[] = [
  { type: "tool", step: { name: "salvar_preferencia", args: { tipo: "dieta", valor: "vegetariano" }, resumo: "Lembrar: dieta → vegetariano" } },
  { type: "state", state: { prefs: { dieta: ["vegetariano"], evitar: [], gostos: [] }, cart: { taxaEntrega: 0, itens: [] }, recent: [] } },
  { type: "tool", step: { name: "buscar_pratos", args: { texto: "bolo", preco_max: 30 }, resumo: "1 prato(s) encontrado(s)" } },
  { type: "dishes", dishes: [bolo] },
  { type: "text", text: "Que tal o **bolo de cenoura**?" },
  { type: "done" },
];

let fetchMock: ReturnType<typeof vi.fn>;
const sentBody = (call = 0) => JSON.parse((fetchMock.mock.calls[call][1] as RequestInit).body as string);
const input = () => screen.getByRole("textbox", { name: "Mensagem" });

beforeEach(() => {
  localStorage.clear();
  fetchMock = vi.fn(async () => ndjson(happy));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("Chat", () => {
  it("clicar numa sugestão envia a mensagem com estado vazio", async () => {
    render(<Chat />);
    await userEvent.click(screen.getByRole("button", { name: "Sou vegetariana, quero algo até R$ 40" }));
    expect(await screen.findByText("bolo de cenoura")).toBeInTheDocument();
    expect(sentBody()).toEqual({
      messages: [{ role: "user", text: "Sou vegetariana, quero algo até R$ 40" }],
      state: { prefs: { dieta: [], evitar: [], gostos: [] }, cart: { taxaEntrega: 0, itens: [] }, recent: [] },
      restaurantes: [],
    });
  });

  it("mostra os passos da IA em 'Como a IA pensou'", async () => {
    render(<Chat />);
    await userEvent.type(input(), "bolo{Enter}");
    const steps = await screen.findByText(/Como a IA pensou \(2 passos\)/);
    expect(steps).toBeInTheDocument();
    expect(screen.getByText("Lembrar: dieta → vegetariano")).toBeInTheDocument();
    expect(screen.getByText(/buscar_pratos/)).toBeInTheDocument();
  });

  it("evento state atualiza as preferências e remover uma preferência vai na próxima mensagem", async () => {
    render(<Chat />);
    await userEvent.type(input(), "bolo{Enter}");
    const panel = await screen.findByRole("region", { name: "Seu pedido" });
    expect(within(panel).getByText("vegetariano")).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole("button", { name: "Remover preferência vegetariano" }));
    await userEvent.type(input(), "e agora?{Enter}");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(sentBody(1).state.prefs.dieta).toEqual([]);
  });

  it("card de prato com botão Adicionar coloca no carrinho com total", async () => {
    render(<Chat />);
    await userEvent.type(input(), "bolo{Enter}");
    const card = (await screen.findByText("Bolo de Cenoura com Chocolate")).closest("li")!;
    expect(within(card).getByText("Café do Largo · Centro")).toBeInTheDocument();
    await userEvent.click(within(card).getByRole("button", { name: /Adicionar/ }));
    await userEvent.click(within(card).getByRole("button", { name: /Adicionar/ }));
    const panel = screen.getByRole("region", { name: "Seu pedido" });
    expect(within(panel).getByText("2×")).toBeInTheDocument();
    expect(within(panel).getByText("R$ 33,90")).toBeInTheDocument(); // 2 × 15 + 3,90
  });

  it("finalizar pedido simulado mostra confirmação e esvazia o carrinho", async () => {
    render(<Chat />);
    await userEvent.type(input(), "bolo{Enter}");
    const card = (await screen.findByText("Bolo de Cenoura com Chocolate")).closest("li")!;
    await userEvent.click(within(card).getByRole("button", { name: /Adicionar/ }));
    await userEvent.click(screen.getByRole("button", { name: "Finalizar pedido" }));
    expect(screen.getByRole("status")).toHaveTextContent(/Pedido simulado/);
    expect(within(screen.getByRole("region", { name: "Seu pedido" })).getByText(/carrinho está vazio/)).toBeInTheDocument();
  });

  it("envia os restaurantes importados salvos no navegador", async () => {
    const imp = { id: "imp-x", nome: "Importado", culinaria: "x", bairro: "y", tempoEntregaMin: 30, taxaEntrega: 0, nota: 0, rodizio: false, origem: "importado", itens: [] };
    localStorage.setItem("garfada:restaurantes", JSON.stringify([imp]));
    render(<Chat />);
    await userEvent.type(input(), "oi{Enter}");
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(sentBody().restaurantes).toEqual([imp]);
  });

  it("evento error aparece como bolha de erro", async () => {
    fetchMock.mockResolvedValueOnce(ndjson([{ type: "error", message: QUOTA }]));
    render(<Chat />);
    await userEvent.type(input(), "pizza{Enter}");
    expect(await screen.findByText(QUOTA)).toBeInTheDocument();
  });

  it("resposta HTTP 429 mostra o campo error do JSON", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: "Muitas mensagens. Tente de novo em alguns minutos." }, { status: 429 }));
    render(<Chat />);
    await userEvent.type(input(), "pizza{Enter}");
    expect(await screen.findByText("Muitas mensagens. Tente de novo em alguns minutos.")).toBeInTheDocument();
  });

  it("falha de rede mostra mensagem de sem conexão", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<Chat />);
    await userEvent.type(input(), "pizza{Enter}");
    expect(await screen.findByText("Sem conexão. Verifique sua internet e tente de novo.")).toBeInTheDocument();
  });

  it("botão enviar desabilitado com texto vazio ou só espaços; input com maxLength 500", async () => {
    render(<Chat />);
    const send = screen.getByRole("button", { name: "Enviar" });
    expect(input()).toHaveAttribute("maxLength", "500");
    expect(send).toBeDisabled();
    await userEvent.type(input(), "   {Enter}");
    expect(fetchMock).not.toHaveBeenCalled();
    await userEvent.type(input(), "pizza");
    expect(send).toBeEnabled();
  });

  it("markdown seguro: sem HTML cru, sem imagens e links em nova aba", async () => {
    fetchMock.mockResolvedValueOnce(ndjson([{ type: "text", text: "**X** <img src=x onerror=alert(1)> [Mapa](https://x.com) ![a](https://x.com/a.png)" }, { type: "done" }]));
    const { container } = render(<Chat />);
    await userEvent.type(input(), "pizza{Enter}");
    expect(await screen.findByText("X", { selector: "strong" })).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("link", { name: "Mapa" })).toHaveAttribute("target", "_blank");
  });

  it("enquanto a IA responde, botões que mudam o carrinho ficam desabilitados", async () => {
    let release!: (r: Response) => void;
    fetchMock.mockResolvedValueOnce(ndjson(happy));
    render(<Chat />);
    await userEvent.type(input(), "bolo{Enter}");
    const card = (await screen.findByText("Bolo de Cenoura com Chocolate")).closest("li")!;
    fetchMock.mockReturnValueOnce(new Promise<Response>((r) => (release = r)));
    await userEvent.type(input(), "e mais?{Enter}");
    expect(within(card).getByRole("button", { name: /Adicionar/ })).toBeDisabled();
    release(ndjson([{ type: "text", text: "ok" }, { type: "done" }]));
    await waitFor(() => expect(within(card).getByRole("button", { name: /Adicionar/ })).toBeEnabled());
  });

  it("card não adiciona prato que viola restrição salva", async () => {
    const camarao: DishResult = { ...bolo, itemId: "forno-da-vila-4", nome: "Pizza de Camarão", descricao: "camarão", tags: [], restaurante: { ...bolo.restaurante, id: "forno-da-vila", nome: "Forno da Vila" } };
    fetchMock.mockResolvedValueOnce(ndjson([
      { type: "state", state: { prefs: { dieta: [], evitar: ["camarão"], gostos: [] }, cart: { taxaEntrega: 0, itens: [] }, recent: [] } },
      { type: "dishes", dishes: [camarao] },
      { type: "text", text: "ok" },
      { type: "done" },
    ]));
    render(<Chat />);
    await userEvent.type(input(), "pizza{Enter}");
    const card = (await screen.findByText("Pizza de Camarão")).closest("li")!;
    await userEvent.click(within(card).getByRole("button", { name: /Adicionar/ }));
    const panel = screen.getByRole("region", { name: "Seu pedido" });
    expect(within(panel).getByText(/carrinho está vazio/)).toBeInTheDocument();
    expect(within(panel).getByRole("status")).toHaveTextContent(/restrição/);
  });
});
