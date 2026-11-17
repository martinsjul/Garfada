# Chat de Restaurantes com IA: Design

*Data: 2026-11-17 · Status: aguardando aprovação*

## Intenção e porquê

Um site com um chat de IA em que a pessoa pede, em linguagem natural, lugares para comer:
restaurantes e cafeterias. Exemplos de pedidos: "lugares até R$ 50", "onde tem moqueca",
"quero rodízio". A IA responde com lugares **reais**.

É um **protótipo para portfólio/currículo**. O sucesso é medido assim: um recrutador abre o link,
faz uma pergunta e recebe em poucos segundos uma resposta útil, bonita e sem inventar lugares.
O código precisa estar limpo e o README precisa explicar a arquitetura.

## Objetivos

- Chat em português com respostas em streaming (o texto aparece aos poucos).
- Recomendações de lugares reais via **Gemini com grounding no Google Maps**.
- Entender pedidos por **faixa de preço**, **prato específico** e **tipo de serviço** (rodízio,
  self-service, café etc.).
- Mostrar cada lugar recomendado como um **card**, com nome, nota, endereço e link para o Google Maps.
- **Custo zero**: hospedagem grátis na Vercel e cota gratuita da API do Gemini.
- Funcionar bem no celular.

## Fora do escopo

- Login, contas, favoritos, histórico salvo no servidor.
- Base própria de restaurantes. Ela fica como extensão futura (a "opção 2" da conversa).
- Reservas, pedidos e pagamentos.
- Precisão garantida de cardápio e preço. O Maps não tem esses dados de forma confiável, e o
  site deixa isso claro.

## Anti-objetivos (seria um fracasso mesmo funcionando)

- A IA **inventar** restaurantes ou endereços.
- A primeira resposta demorar muito ou dar erro feio na hora da demo.
- A chave da API aparecer no navegador ou no repositório.
- Alguém esgotar a cota gratuita e a demo quebrar sem explicação.

## Restrições

- Totalmente gratuito: plano Hobby da Vercel e free tier do Gemini API (Google AI Studio).
  O grounding com Maps tem limite diário gratuito. Os números variam por modelo, então devem ser
  conferidos na página de preços oficial.
- A chave `GEMINI_API_KEY` fica só no servidor, em variável de ambiente.
- O free tier do Gemini pode usar os dados para melhorar os produtos do Google. Isso é aceitável
  para um protótipo, e o site avisa que não se deve digitar dados pessoais.

## Abordagens consideradas

1. **Next.js na Vercel + Gemini com Google Maps grounding** ✅ *escolhida*
   Frontend e backend num só projeto, hospedagem grátis sem "dormir" e lugares reais de
   qualquer cidade. Contra: pratos e rodízio às vezes imprecisos.
2. **Gemini + base própria com function calling.** Filtros 100% precisos e mais
   "engenharia" para mostrar, mas cobre só os lugares cadastrados. Fica como extensão futura.
3. **Site estático + servidor separado no Render.** Grátis, mas o servidor dorme e a primeira
   resposta demora de 30 a 50 s. Descartada por causa da demo.

Escolhida pelo usuário: **opção 1**.

## Como funciona

```
Navegador (React)  ──POST /api/chat──▶  Route Handler (servidor Next.js)
   mensagens + localização opcional        │  adiciona instruções de sistema
                                           │  chama Gemini com tool googleMaps
   ◀── streaming de texto + lugares ───────┘  extrai groundingMetadata → cards
```

- **Stack** *(decisão do Claude)*: Next.js (App Router) + TypeScript + Tailwind CSS, SDK oficial
  `@google/genai` e deploy na Vercel. Motivo: é muito pedida em vagas e o deploy é direto.
- **Modelo** *(decisão do Claude)*: o modelo **Flash** mais recente que suporte grounding com
  Google Maps no free tier. É rápido e tem a maior cota gratuita.
- **Instruções de sistema**: responder em português. Recomendar só lugares vindos do Maps.
  Ao falar de preço, usar a faixa do Maps ($ a $$$$) e explicar que é aproximada. Quando não tiver
  certeza de um prato ou de rodízio, dizer "segundo avaliações…" ou sugerir confirmar com o lugar.
  Pedir a cidade ou o bairro quando não souber onde a pessoa está.
- **Localização** *(decisão do Claude, pendente de confirmação)*: um botão opcional "usar minha
  localização" envia latitude e longitude ao Gemini. Sem ele, a pessoa diz a cidade ou o bairro
  na conversa.
- **Cards de lugares**: montados a partir dos metadados de grounding que a API devolve (nome,
  link do Maps e o que mais vier disponível). Não são extraídos do texto da IA.
- **Atribuição**: exibir a atribuição do Google Maps exigida pelos termos da API.
- **Proteção da cota** *(decisão do Claude)*: limite simples de mensagens por IP no servidor
  (em memória, por instância, como melhor esforço) e limite de tamanho da conversa enviada. Se a
  cota do Gemini estourar, aparece uma mensagem amigável ("a demo atingiu o limite de hoje,
  volte amanhã") em vez de erro.
- **Tela**: cabeçalho com o nome do projeto, sugestões de perguntas clicáveis ("Rodízio de pizza
  perto de mim", "Café com bolo até R$ 30", "Onde comer feijoada?"), área de chat e campo de
  texto. Histórico só na memória da página.

```
┌──────────────────────────────────┐
│  🍽️  NomeDoProjeto               │
├──────────────────────────────────┤
│ [Rodízio perto de mim] [Café...] │
│                                  │
│  Você: rodízio de pizza no centro│
│  IA: Achei 3 opções...           │
│  ┌────────────┐ ┌────────────┐   │
│  │ Pizzaria X │ │ Cantina Y  │   │
│  │ ★4.6 · $$  │ │ ★4.4 · $   │   │
│  │ Ver no Maps│ │ Ver no Maps│   │
│  └────────────┘ └────────────┘   │
├──────────────────────────────────┤
│ 📍 [Pergunte algo...]      [➤]   │
└──────────────────────────────────┘
```

## Entregáveis

- Repositório com código, `.env.example` e um **README** voltado a recrutadores: o que é,
  screenshot/GIF, arquitetura, como rodar localmente e decisões técnicas.
- Deploy na Vercel com link público. O usuário cria a conta e a chave no Google AI Studio.

## Deixado para quem implementar

- Nome e identidade visual do projeto.
- Estrutura exata de pastas e componentes.
- Formato exato do streaming e de como os cards chegam ao cliente.
- Testes: unitários para a extração de lugares dos metadados e para o rate limit; um teste de
  ponta a ponta com a API do Gemini simulada.
