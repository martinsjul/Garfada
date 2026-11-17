import { expect, test } from "@playwright/test";

const events = [
  { type: "text", text: "Achei **2 opções** de rodízio de pizza perto de você:\n\n" },
  {
    type: "text",
    text:
      "1. **Pizzaria Bella Massa** — ⭐ 4,6 · $$ · rodízio com mais de 40 sabores, segundo avaliações.\n" +
      "2. **Cantina do Bairro** — ⭐ 4,4 · $ · rodízio barato às terças.\n\n" +
      "Os preços são aproximados; vale confirmar com o local. 🍕",
  },
  {
    type: "places",
    places: [
      { id: "p1", name: "Pizzaria Bella Massa", mapsUrl: "https://maps.google.com/?cid=1" },
      { id: "p2", name: "Cantina do Bairro", mapsUrl: "https://maps.google.com/?cid=2" },
    ],
  },
  { type: "done" },
];

test("pergunta por sugestão e mostra os cards de lugares", async ({ page }, testInfo) => {
  await page.route("**/api/chat", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/x-ndjson",
      body: events.map((e) => JSON.stringify(e)).join("\n") + "\n",
    }),
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Rodízio de pizza perto de mim" }).click();

  await expect(page.getByRole("link", { name: /Ver no Google Maps/ })).toHaveCount(2);
  await expect(page.getByText("Dados de lugares: Google Maps")).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);

  if (testInfo.project.name === "desktop") {
    await page.screenshot({ path: "docs/screenshot.png" });
  } else {
    await page.screenshot({ path: "docs/screenshot-mobile.png" });
  }
});
