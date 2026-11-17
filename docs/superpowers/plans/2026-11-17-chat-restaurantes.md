# Chat de Restaurantes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Site Next.js com um chat em português que recomenda restaurantes/cafeterias reais usando Gemini com grounding no Google Maps, hospedável grátis na Vercel.

**Architecture:** O cliente React envia o histórico (e a localização opcional) para `POST /api/chat`. O Route Handler valida, aplica rate limit e chama o Gemini com a tool `googleMaps` em streaming. A resposta volta como NDJSON com eventos `text`, `places`, `error` e `done`. Os cards de lugares vêm de `groundingMetadata.groundingChunks[].maps` (`title`, `uri`, `placeId`), nunca do texto da IA.

**Tech Stack:** Next.js (App Router, versão estável atual) + TypeScript + Tailwind CSS, `@google/genai`, `react-markdown`, Vitest + Testing Library, Playwright (E2E).

**Spec:** `docs/superpowers/specs/2026-11-17-chat-restaurantes-design.md`

## Global Constraints

- Custo zero: Vercel Hobby + free tier do Gemini API.
- `GEMINI_API_KEY` só no servidor; nunca importar `lib/gemini.ts` em componente cliente; `.env.local` no `.gitignore`.
- Modelo via env `GEMINI_MODEL`, default `gemini-2.5-flash`. Antes de começar, conferir em ai.google.dev/gemini-api/docs/generate-content/maps-grounding qual é o Flash atual com suporte a Maps e atualizar o default.
- Todo texto visível ao usuário em **português do Brasil**.
- Exibir atribuição "Dados de lugares: Google Maps" sempre que houver cards.
- Aviso no rodapé: "Protótipo. Não digite dados pessoais. Preços e cardápios são aproximados — confirme com o local."
- Os metadados do Maps só trazem `title`, `uri` e `placeId`. Por isso o card mostra **nome + link "Ver no Google Maps"**, e nota e faixa de preço aparecem no texto da IA. Isso ajusta o spec, que previa nota e endereço no card.
- Limites: no máximo **20 mensagens por IP a cada 1 hora**; mensagem com no máximo **500 caracteres**; enviar ao Gemini só as **últimas 10 mensagens**.

## Review Focus

1. **Gemini sem grounding chunks** (pergunta vaga, resposta sem lugares): o texto aparece normalmente, sem cards e sem erro → teste em Task 1 (`extractPlaces` com metadata ausente) e Task 3.
2. **Cota estourada (429 / RESOURCE_EXHAUSTED)**, inclusive no meio do stream: a mensagem amigável "A demo atingiu o limite gratuito de hoje. Volte amanhã! 🙏" aparece no lugar do erro → testes em Task 3 e Task 4.
3. **Localização negada ou indisponível**: o chat continua funcionando sem `latLng`, e o botão mostra "Localização indisponível" → teste em Task 5.
4. **Mensagem vazia, só espaços ou com mais de 500 caracteres**: o envio fica bloqueado no cliente, e o servidor responde 400 com mensagem em português → testes em Task 4 e Task 5.
5. **Lugar repetido nos chunks** (o mesmo `placeId` duas vezes): aparece só um card → teste em Task 1.

---

### Task 1: Projeto base + extração de lugares

**Files:**
- Create: projeto via `npx create-next-app@latest chat-restaurantes --ts --tailwind --app --eslint --src-dir --import-alias "@/*" --use-npm` (rodar em `/home/user`, preservando a pasta `docs/` já existente: criar num diretório temporário e mover os arquivos para dentro)
- Create: `vitest.config.ts` (environment `jsdom`, alias `@` → `src`), `src/lib/types.ts`, `src/lib/places.ts`
- Test: `src/lib/places.test.ts`

**Interfaces:**
- Produces (`src/lib/types.ts`):
  ```ts
  export type Role = "user" | "assistant";
  export interface ChatMessage { role: Role; text: string }
  export interface Place { id: string; name: string; mapsUrl: string }
  export interface LatLng { latitude: number; longitude: number }
  export type StreamEvent =
    | { type: "text"; text: string }
    | { type: "places"; places: Place[] }
    | { type: "error"; message: string }
    | { type: "done" };
  ```
- Produces: `extractPlaces(metadata: unknown): Place[]` em `src/lib/places.ts`

- [ ] **Step 1:** `git init`; criar o projeto; instalar `vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom`; adicionar o script `"test": "vitest run"`.
- [ ] **Step 2: Escrever os testes que falham** em `places.test.ts`:
  - `extrai lugares dos chunks maps`: `{groundingChunks:[{maps:{title:"Pizzaria X",uri:"https://maps.google.com/?cid=1",placeId:"places/abc"}}]}` → `[{id:"places/abc",name:"Pizzaria X",mapsUrl:"https://maps.google.com/?cid=1"}]`
  - `ignora chunks sem maps ou sem uri/title` (ex.: `{web:{...}}`, `{maps:{title:"A"}}`) → `[]`
  - `retorna [] para metadata undefined/null/sem groundingChunks`
  - `remove duplicados por placeId (ou por uri quando não há placeId)`
  - `aceita só uri http(s)`: `uri:"javascript:alert(1)"` é ignorado
- [ ] **Step 3:** `npm test -- places` → FAIL (módulo não existe).
- [ ] **Step 4:** Implementar `extractPlaces`. Validar em tempo de execução, sem cast cego, porque o input é `unknown`; `id = placeId ?? uri`.
- [ ] **Step 5:** `npm test -- places` → PASS.
- [ ] **Step 6:** Commit `feat: scaffold Next.js e extração de lugares do grounding`.

### Task 2: Rate limiter

**Files:**
- Create: `src/lib/rateLimit.ts`
- Test: `src/lib/rateLimit.test.ts`

**Interfaces:**
- Produces: `createRateLimiter(opts: { limit: number; windowMs: number; now?: () => number }): { check(key: string): { ok: boolean; retryAfterSec: number } }`
- Produces: `chatLimiter` = `createRateLimiter({ limit: 20, windowMs: 3_600_000 })`

- [ ] **Step 1: Testes que falham:**
  - `permite até o limite e bloqueia o seguinte` (limit 3: três `ok:true`, o quarto `ok:false`, `retryAfterSec > 0`)
  - `libera de novo após a janela` (avançar o `now` fake em `windowMs + 1`)
  - `chaves diferentes são independentes`
- [ ] **Step 2:** `npm test -- rateLimit` → FAIL.
- [ ] **Step 3:** Implementar com `Map<string, number[]>` de timestamps (janela deslizante). É em memória e por instância, como melhor esforço, conforme o spec. Descartar timestamps antigos a cada `check`.
- [ ] **Step 4:** `npm test -- rateLimit` → PASS.
- [ ] **Step 5:** Commit `feat: rate limiter em memória`.

### Task 3: Cliente Gemini em streaming

**Files:**
- Create: `src/lib/gemini.ts` (começa com `import "server-only"`; instalar `server-only`), `src/lib/systemPrompt.ts`
- Test: `src/lib/gemini.test.ts` (mock de `server-only` e do client)

**Interfaces:**
- Consumes: `extractPlaces`, os tipos da Task 1
- Produces:
  ```ts
  export interface GenAIStreamClient {
    generateContentStream(req: unknown): Promise<AsyncIterable<{ text?: string; candidates?: { groundingMetadata?: unknown }[] }>>;
  }
  export function buildRequest(messages: ChatMessage[], location?: LatLng, model?: string): object;
  export function streamChat(client: GenAIStreamClient, messages: ChatMessage[], location?: LatLng): AsyncGenerator<StreamEvent>;
  export function getDefaultClient(): GenAIStreamClient; // new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }).models
  export const QUOTA_MESSAGE = "A demo atingiu o limite gratuito de hoje. Volte amanhã! 🙏";
  export const GENERIC_ERROR = "Ops, algo deu errado ao falar com a IA. Tente de novo.";
  ```

- [ ] **Step 1: Testes que falham:**
  - `buildRequest usa a tool googleMaps e as últimas 10 mensagens`: com 12 mensagens → `contents.length === 10`; role `assistant` vira `"model"`; `config.tools` deep-equals `[{ googleMaps: {} }]`; `config.systemInstruction === SYSTEM_PROMPT`
  - `buildRequest inclui latLng quando há localização`: `config.toolConfig.retrievalConfig.latLng` = `{latitude:-23.5,longitude:-46.6}`; sem localização, `toolConfig` fica ausente
  - `streamChat emite text, depois places, depois done` (fake com chunks `"Achei "`, `"2 lugares"`, e o último com groundingMetadata de 2 maps)
  - `streamChat sem grounding emite text e done, sem evento places`
  - `streamChat converte 429/RESOURCE_EXHAUSTED em error com QUOTA_MESSAGE` (fake que lança `{status:429}` ao iterar, depois do primeiro chunk)
  - `streamChat converte outros erros em GENERIC_ERROR`
- [ ] **Step 2:** `npm test -- gemini` → FAIL.
- [ ] **Step 3:** Escrever `SYSTEM_PROMPT` em `systemPrompt.ts` com estas regras do spec: responder em pt-BR; recomendar só lugares encontrados no Google Maps, sem inventar; faixa de preço como $–$$$$ e avisar que é aproximada; ao relacionar R$ com faixa, dizer que é estimativa; para pratos e rodízio sem certeza, usar "segundo avaliações…" e sugerir confirmar; pedir a cidade ou o bairro quando não houver localização nem lugar citado; de 3 a 5 recomendações, cada uma com nome em negrito, nota e o motivo; respostas curtas em markdown.
- [ ] **Step 4:** Implementar `buildRequest` (model = `process.env.GEMINI_MODEL ?? "gemini-2.5-flash"`) e `streamChat`. Acumular a metadata do último chunk que a tiver e emitir `places` uma vez, ao fim, só se não estiver vazio. Detecção de cota: `status === 429` ou mensagem contendo `RESOURCE_EXHAUSTED`. Logar o erro original com `console.error`.
- [ ] **Step 5:** `npm test -- gemini` → PASS.
- [ ] **Step 6:** Commit `feat: cliente Gemini com grounding no Maps em streaming`.

### Task 4: Rota `POST /api/chat`

**Files:**
- Create: `src/app/api/chat/route.ts`, `src/lib/validate.ts`
- Test: `src/app/api/chat/route.test.ts`, `src/lib/validate.test.ts`

**Interfaces:**
- Consumes: `streamChat`, `getDefaultClient`, `chatLimiter`, `QUOTA_MESSAGE`
- Produces: `parseChatBody(body: unknown): { ok: true; messages: ChatMessage[]; location?: LatLng } | { ok: false; error: string }`
- Produces: o contrato HTTP. Request `{ messages: ChatMessage[]; location?: LatLng }`. Response `200`, `Content-Type: application/x-ndjson`, um `StreamEvent` JSON por linha. Erros antes do stream: `400 { error }`, `429 { error }` com header `Retry-After`.
- Para testar: `route.ts` exporta `POST` e usa `getDefaultClient()`. Nos testes, `vi.mock("@/lib/gemini")`.

- [ ] **Step 1: Testes que falham (validate):**
  - última mensagem vazia ou só espaços → `{ok:false, error:"Escreva uma mensagem."}`
  - mensagem com mais de 500 caracteres → `{ok:false, error:"Mensagem muito longa (máx. 500 caracteres)."}`
  - última mensagem com role diferente de `user`, `messages` não-array ou vazio → `{ok:false, error:"Requisição inválida."}`
  - `location` com latitude fora de [-90,90] ou longitude fora de [-180,180] → descartada (ok, sem location)
- [ ] **Step 2: Testes que falham (route):**
  - body inválido → 400 com `error` em pt-BR
  - a 21ª chamada do mesmo IP (header `x-forwarded-for`, primeiro valor) → 429, `error:"Muitas mensagens. Tente de novo em alguns minutos."`, header `Retry-After`
  - caminho feliz → 200, NDJSON cujas linhas fazem parse para os eventos emitidos pelo `streamChat` mockado
- [ ] **Step 3:** `npm test -- route validate` → FAIL.
- [ ] **Step 4:** Implementar. `export const runtime = "nodejs"`. A resposta é um `ReadableStream` que serializa cada evento + `"\n"`. Usar `try/finally` para sempre fechar o stream.
- [ ] **Step 5:** `npm test` → tudo PASS.
- [ ] **Step 6: Teste manual real:** criar `.env.local` com uma chave do AI Studio, rodar `npm run dev` e depois `curl -N -X POST localhost:3000/api/chat -H 'content-type: application/json' -d '{"messages":[{"role":"user","text":"rodízio de pizza na Vila Madalena, São Paulo"}]}'`. Esperado: linhas `text`, uma linha `places` com 1 ou mais itens e `done`. Se não houver chave disponível, registrar como "não verificado" e seguir.
- [ ] **Step 7:** Commit `feat: rota de chat com validação, rate limit e NDJSON`.

### Task 5: Interface do chat

**Files:**
- Create: `src/lib/readEvents.ts`, `src/hooks/useChat.ts`, `src/hooks/useGeolocation.ts`
- Create: `src/components/Chat.tsx` (`"use client"`), `MessageBubble.tsx`, `PlaceCard.tsx`, `Suggestions.tsx`, `LocationButton.tsx`, `ChatInput.tsx`
- Modify: `src/app/page.tsx`, `src/app/layout.tsx` (`lang="pt-BR"`, metadata title/description), `src/app/globals.css`
- Test: `src/lib/readEvents.test.ts`, `src/components/Chat.test.tsx`

**Interfaces:**
- Consumes: os tipos da Task 1 e o contrato HTTP da Task 4
- Produces: `readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamEvent>` (divide por `\n`, guarda o pedaço parcial entre chunks, ignora linhas vazias)
- Produces: `useChat(): { messages: UIMessage[]; send(text: string): Promise<void>; loading: boolean; location: LatLng | undefined; setLocation(l?: LatLng): void }` com `UIMessage = ChatMessage & { places?: Place[]; error?: boolean }`
- Produces: `useGeolocation(): { status: "idle" | "loading" | "ok" | "unavailable"; request(): void; coords?: LatLng }`

Layout (do spec): cabeçalho com nome e emoji 🍽️; sugestões clicáveis quando o chat está vazio: "Rodízio de pizza perto de mim", "Café com bolo até R$ 30", "Onde comer uma boa feijoada?", "Japonês barato no centro"; bolhas de mensagem; cards em grade embaixo da bolha da IA; campo com botão 📍 à esquerda e ➤ à direita; rodapé com o aviso das Global Constraints. Mobile first.

- [ ] **Step 1: Testes que falham (readEvents):**
  - `junta linhas quebradas entre chunks` (`'{"type":"te'` + `'xt","text":"oi"}\n{"type":"done"}\n'` → 2 eventos)
  - `ignora linhas vazias`
- [ ] **Step 2: Testes que falham (Chat.test.tsx)**, com `fetch` mockado devolvendo NDJSON:
  - `clicar numa sugestão envia a mensagem`: a sugestão some, aparece a bolha do usuário, e o texto da IA "Achei 2 lugares" é renderizado
  - `renderiza um card por lugar com link do Maps` (`getAllByRole("link", {name:/Ver no Google Maps/})` com length 2, `href` correto, `target="_blank"`, `rel` contendo `noopener`) e mostra "Dados de lugares: Google Maps"
  - `evento error aparece como bolha de erro` com o texto de `QUOTA_MESSAGE`
  - `resposta HTTP 429/400 mostra o campo error do JSON`
  - `botão enviar desabilitado com texto vazio, só espaços ou durante loading`; o input tem `maxLength={500}`
  - `localização negada mostra "Localização indisponível" e o envio funciona sem location` (mock de `navigator.geolocation.getCurrentPosition` chamando o callback de erro)
  - `markdown é renderizado sem HTML cru`: texto `**Pizzaria X** <img src=x onerror=alert(1)>` → `<strong>` presente e nenhum `img`
- [ ] **Step 3:** `npm test -- readEvents Chat` → FAIL.
- [ ] **Step 4:** Implementar. A bolha da IA é criada vazia e vai crescendo a cada `text`. `places` é anexado à última mensagem da IA. Falha de rede vira a bolha "Sem conexão. Verifique sua internet e tente de novo.". Usar `react-markdown` (sem `rehype-raw`). Auto-scroll para o fim a cada atualização.
- [ ] **Step 5:** `npm test` → tudo PASS; `npm run lint` e `npm run build` sem erros.
- [ ] **Step 6:** Commit `feat: interface do chat com cards de lugares e localização`.

### Task 6: E2E, README e deploy

**Files:**
- Create: `e2e/chat.spec.ts`, `playwright.config.ts` (webServer `npm run build && npm start`, `GEMINI_API_KEY=fake`), `.env.example`, `README.md`
- Create: `docs/screenshot.png` (gerado pelo próprio teste E2E, com `deviceScaleFactor: 2`)

- [ ] **Step 1: Teste E2E** com `page.route("**/api/chat", ...)` devolvendo NDJSON fixo de 2 lugares. Clicar em "Rodízio de pizza perto de mim", esperar 2 links "Ver no Google Maps" e salvar o screenshot. Rodar também com o viewport `iPhone 13` e conferir que não há scroll horizontal (`document.documentElement.scrollWidth <= innerWidth`).
- [ ] **Step 2:** `npx playwright test --trace off` → PASS.
- [ ] **Step 3:** `.env.example` com `GEMINI_API_KEY=` e `GEMINI_MODEL=gemini-2.5-flash`.
- [ ] **Step 4:** Escrever o README em pt-BR voltado a recrutadores: o que é, screenshot, link da demo (placeholder `<!-- link da Vercel -->`), diagrama de arquitetura (o do spec), decisões técnicas (por que grounding em vez de deixar a IA "lembrar"; por que os cards vêm dos metadados; NDJSON; rate limit; chave só no servidor), limitações honestas (preço aproximado, cardápio via avaliações), como rodar localmente, como fazer deploy na Vercel (importar o repo e definir `GEMINI_API_KEY`) e próximos passos (base própria com function calling).
- [ ] **Step 5:** `npm test && npm run build` → PASS.
- [ ] **Step 6:** Commit `docs: README, E2E e screenshot`.
- [ ] **Step 7 (com o usuário):** o usuário cria a chave no Google AI Studio, sobe o repo para o GitHub e importa na Vercel. Depois, testar 3 perguntas reais (preço, prato, rodízio) no link público.
