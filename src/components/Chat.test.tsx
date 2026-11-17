import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Chat from "./Chat";
import type { StreamEvent } from "@/lib/types";

const QUOTA = "A demo atingiu o limite gratuito de hoje. Volte amanhã! 🙏";

function ndjson(events: StreamEvent[]) {
  return new Response(events.map((e) => JSON.stringify(e)).join("\n") + "\n", {
    headers: { "content-type": "application/x-ndjson" },
  });
}

const happy: StreamEvent[] = [
  { type: "text", text: "Achei " },
  { type: "text", text: "2 lugares" },
  {
    type: "places",
    places: [
      { id: "p1", name: "Pizzaria X", mapsUrl: "https://maps.google.com/?cid=1" },
      { id: "p2", name: "Cantina Y", mapsUrl: "https://maps.google.com/?cid=2" },
    ],
  },
  { type: "done" },
];

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () => ndjson(happy));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function sentBody(call = 0) {
  return JSON.parse((fetchMock.mock.calls[call][1] as RequestInit).body as string);
}

describe("Chat", () => {
  it("clicar numa sugestão envia a mensagem", async () => {
    render(<Chat />);
    await userEvent.click(screen.getByRole("button", { name: "Rodízio de pizza perto de mim" }));
    expect(await screen.findByText("Achei 2 lugares")).toBeInTheDocument();
    expect(screen.getByText("Rodízio de pizza perto de mim")).toBeInTheDocument(); // bolha do usuário
    expect(screen.queryByRole("button", { name: "Café com bolo até R$ 30" })).not.toBeInTheDocument();
    expect(sentBody()).toEqual({ messages: [{ role: "user", text: "Rodízio de pizza perto de mim" }] });
  });

  it("renderiza um card por lugar com link do Maps", async () => {
    render(<Chat />);
    await userEvent.type(screen.getByRole("textbox"), "pizza{Enter}");
    const links = await screen.findAllByRole("link", { name: /Ver no Google Maps/ });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "https://maps.google.com/?cid=1");
    expect(links[0]).toHaveAttribute("target", "_blank");
    expect(links[0].getAttribute("rel")).toContain("noopener");
    expect(screen.getByText("Pizzaria X")).toBeInTheDocument();
    expect(screen.getByText("Dados de lugares: Google Maps")).toBeInTheDocument();
  });

  it("envia o histórico na segunda pergunta", async () => {
    render(<Chat />);
    await userEvent.type(screen.getByRole("textbox"), "pizza{Enter}");
    await screen.findByText("Achei 2 lugares");
    await userEvent.type(screen.getByRole("textbox"), "mais barato{Enter}");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(sentBody(1).messages).toEqual([
      { role: "user", text: "pizza" },
      { role: "assistant", text: "Achei 2 lugares" },
      { role: "user", text: "mais barato" },
    ]);
  });

  it("evento error aparece como bolha de erro", async () => {
    fetchMock.mockResolvedValueOnce(ndjson([{ type: "error", message: QUOTA }]));
    render(<Chat />);
    await userEvent.type(screen.getByRole("textbox"), "pizza{Enter}");
    expect(await screen.findByText(QUOTA)).toBeInTheDocument();
  });

  it("resposta HTTP 429 mostra o campo error do JSON", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ error: "Muitas mensagens. Tente de novo em alguns minutos." }, { status: 429 }),
    );
    render(<Chat />);
    await userEvent.type(screen.getByRole("textbox"), "pizza{Enter}");
    expect(await screen.findByText("Muitas mensagens. Tente de novo em alguns minutos.")).toBeInTheDocument();
  });

  it("falha de rede mostra mensagem de sem conexão", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<Chat />);
    await userEvent.type(screen.getByRole("textbox"), "pizza{Enter}");
    expect(await screen.findByText("Sem conexão. Verifique sua internet e tente de novo.")).toBeInTheDocument();
  });

  it("botão enviar desabilitado com texto vazio ou só espaços; input com maxLength 500", async () => {
    render(<Chat />);
    const send = screen.getByRole("button", { name: "Enviar" });
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("maxLength", "500");
    expect(send).toBeDisabled();
    await userEvent.type(input, "   ");
    expect(send).toBeDisabled();
    await userEvent.type(input, "{Enter}");
    expect(fetchMock).not.toHaveBeenCalled();
    await userEvent.type(input, "pizza");
    expect(send).toBeEnabled();
  });

  it("botão enviar desabilitado durante o carregamento", async () => {
    let release!: (r: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((r) => (release = r)));
    render(<Chat />);
    await userEvent.type(screen.getByRole("textbox"), "pizza{Enter}");
    await userEvent.type(screen.getByRole("textbox"), "outra");
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
    release(ndjson(happy));
    await screen.findByText("Achei 2 lugares");
  });

  it("localização concedida é enviada junto", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: {
        getCurrentPosition: (ok: PositionCallback) =>
          ok({ coords: { latitude: -23.5, longitude: -46.6 } } as GeolocationPosition),
      },
    });
    render(<Chat />);
    await userEvent.click(screen.getByRole("button", { name: "Usar minha localização" }));
    expect(await screen.findByRole("button", { name: "Localização ativada" })).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox"), "pizza{Enter}");
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(sentBody().location).toEqual({ latitude: -23.5, longitude: -46.6 });
  });

  it("localização negada mostra 'Localização indisponível' e o envio funciona sem location", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: {
        getCurrentPosition: (_ok: PositionCallback, err: PositionErrorCallback) =>
          err({ code: 1, message: "denied" } as GeolocationPositionError),
      },
    });
    render(<Chat />);
    await userEvent.click(screen.getByRole("button", { name: "Usar minha localização" }));
    expect(await screen.findByText("Localização indisponível")).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox"), "pizza{Enter}");
    await screen.findByText("Achei 2 lugares");
    expect(sentBody().location).toBeUndefined();
  });

  it("markdown é renderizado sem HTML cru", async () => {
    fetchMock.mockResolvedValueOnce(
      ndjson([{ type: "text", text: "**Pizzaria X** <img src=x onerror=alert(1)>" }, { type: "done" }]),
    );
    const { container } = render(<Chat />);
    await userEvent.type(screen.getByRole("textbox"), "pizza{Enter}");
    expect(await screen.findByText("Pizzaria X", { selector: "strong" })).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("links do markdown abrem em nova aba e imagens não são carregadas", async () => {
    fetchMock.mockResolvedValueOnce(
      ndjson([{ type: "text", text: "[Mapa](https://maps.google.com/?cid=9) ![foto](https://x.com/a.png)" }, { type: "done" }]),
    );
    const { container } = render(<Chat />);
    await userEvent.type(screen.getByRole("textbox"), "pizza{Enter}");
    const link = await screen.findByRole("link", { name: "Mapa" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(container.querySelector("img")).toBeNull();
  });
});
