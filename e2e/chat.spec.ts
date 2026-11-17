import { expect, test } from "@playwright/test";

const dish = (itemId: string, nome: string, preco: number, restaurante: { id: string; nome: string; bairro: string }, tags: string[] = []) => ({
  itemId, nome, descricao: "", preco, categoria: "massas", tags,
  restaurante: { ...restaurante, tempoEntregaMin: 45, taxaEntrega: 6.5, nota: 4.7 },
});

const trattoria = { id: "trattoria-bixiga", nome: "Trattoria do Bixiga", bairro: "Bela Vista" };
const turn1 = [
  { type: "tool", step: { name: "salvar_preferencia", args: { tipo: "dieta", valor: "vegetariano" }, resumo: "Lembrar: dieta → vegetariano" } },
  { type: "state", state: { prefs: { dieta: ["vegetariano"], evitar: ["cogumelo"], gostos: [] }, cart: { taxaEntrega: 0, itens: [] }, recent: ["trattoria-bixiga-4", "trattoria-bixiga-2"] } },
  { type: "tool", step: { name: "buscar_pratos", args: { texto: "massa", preco_max: 50, tags: ["vegetariano"] }, resumo: "2 prato(s) encontrado(s)" } },
  {
    type: "dishes",
    dishes: [
      { ...dish("trattoria-bixiga-4", "Nhoque ao Sugo", 44, trattoria, ["vegetariano", "sem_lactose"]), descricao: "nhoque de batata com molho de tomate fresco" },
      { ...dish("trattoria-bixiga-2", "Fettuccine ao Pesto", 52, trattoria, ["vegetariano"]), descricao: "pesto de manjericão, parmesão e pinoli" },
    ],
  },
  { type: "text", text: "Anotei: **vegetariana** e **sem cogumelo**. Minha sugestão é o **Nhoque ao Sugo** (R$ 44,00) da Trattoria do Bixiga. Quer que eu coloque no carrinho?" },
  { type: "done" },
];
const turn2 = [
  { type: "tool", step: { name: "adicionar_ao_carrinho", args: { item_id: "trattoria-bixiga-4", quantidade: 2 }, resumo: "+2× Nhoque ao Sugo" } },
  {
    type: "state",
    state: {
      prefs: { dieta: ["vegetariano"], evitar: ["cogumelo"], gostos: [] },
      cart: { restauranteId: "trattoria-bixiga", restauranteNome: "Trattoria do Bixiga", taxaEntrega: 6.5, itens: [{ itemId: "trattoria-bixiga-4", nome: "Nhoque ao Sugo", preco: 44, quantidade: 2 }] },
      recent: ["trattoria-bixiga-4", "trattoria-bixiga-2"],
    },
  },
  { type: "text", text: "Prontinho! **2× Nhoque ao Sugo** no carrinho. Total: **R$ 94,50** com a entrega. É só clicar em *Finalizar pedido*." },
  { type: "done" },
];

const draft = {
  restaurante: { nome: "Cantina Nonna Rosa", culinaria: "italiana" },
  itens: [
    { nome: "Spaghetti ao Sugo", descricao: "Clássico com tomate fresco e manjericão", descricaoOriginal: "molho de tomate fresco e manjericão", preco: 38, categoria: "massas", tags: ["vegetariano"] },
    { nome: "Lasanha da Nonna", descricao: "Ragu de carne e bechamel cremoso", descricaoOriginal: "ragu de carne e bechamel", preco: 54, categoria: "massas", tags: [] },
    { nome: "Tiramisù", descricao: "Café, mascarpone e cacau", descricaoOriginal: "café, mascarpone e cacau", preco: 22, categoria: "sobremesas", tags: ["vegetariano"] },
  ],
  combos: [{ nome: "Combo Nonna", itens: ["Lasanha da Nonna", "Tiramisù"], precoSugerido: 70, motivo: "refeição completa com sobremesa" }],
};

test("agente: preferências, cards, carrinho e finalização", async ({ page }, testInfo) => {
  let turn = 0;
  await page.route("**/api/chat", (route) => {
    const events = turn++ === 0 ? turn1 : turn2;
    return route.fulfill({ status: 200, contentType: "application/x-ndjson", body: events.map((e) => JSON.stringify(e)).join("\n") + "\n" });
  });

  await page.goto("/");
  const box = page.getByRole("textbox", { name: "Mensagem" });
  await box.fill("Sou vegetariana e não como cogumelo. Quero uma massa até R$ 50");
  await box.press("Enter");
  await expect(page.getByRole("button", { name: "Adicionar Nhoque ao Sugo" })).toBeVisible();
  await box.fill("Coloca 2 do nhoque");
  await box.press("Enter");
  await expect(page.getByText("Como a IA pensou (1 passo)")).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);

  if (testInfo.project.name === "desktop") {
    await expect(page.getByRole("region", { name: "Seu pedido" }).getByText("R$ 94,50")).toBeVisible();
    await page.locator("details").first().evaluate((d) => ((d as HTMLDetailsElement).open = true));
    await page.screenshot({ path: "docs/screenshot.png" });
    await page.getByRole("button", { name: "Finalizar pedido" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Pedido simulado" })).toBeVisible();
  } else {
    await page.screenshot({ path: "docs/screenshot-mobile.png" });
    await page.getByRole("button", { name: /Carrinho com 2 itens/ }).click();
    await expect(page.getByRole("region", { name: "Seu pedido" }).getByText("R$ 94,50")).toBeVisible();
  }
});

test("copiloto: foto do cardápio vira cardápio digital publicado", async ({ page }, testInfo) => {
  await page.route("**/api/menu", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ draft }) }));
  await page.goto("/restaurante");
  await page.getByRole("button", { name: /Cantina Nonna Rosa/ }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByLabel("Bairro").fill("Bixiga");
  if (testInfo.project.name === "desktop") await page.screenshot({ path: "docs/screenshot-restaurante.png", fullPage: true });
  await page.getByRole("button", { name: "Adicionar Combo Nonna ao cardápio" }).click();
  await page.getByRole("button", { name: "Publicar no catálogo" }).click();
  await expect(page.getByRole("list", { name: "Restaurantes publicados" })).toContainText("Cantina Nonna Rosa");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("garfada:restaurantes") ?? "[]"));
  expect(saved[0].itens).toHaveLength(4);
});
