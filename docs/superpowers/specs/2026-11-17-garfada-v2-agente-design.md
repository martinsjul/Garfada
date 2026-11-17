# Garfada v2: agente de pedidos + copiloto do restaurante

*Data: 2026-11-17 · Substitui a abordagem com Google Maps de `2026-11-17-chat-restaurantes-design.md`*

## Por que mudou

- O teste com uma chave real mostrou que **o grounding com Google Maps e Search tem cota zero** no plano
  gratuito dessa chave. Sem cartão, não funciona.
- O objetivo agora está claro: **portfólio para o time de GenAI do iFood**. Por isso o projeto precisa mostrar
  o que esse time constrói: **agentes com ferramentas**, **personalização** (gostos e restrições),
  **pedido por conversa**, **IA multimodal para restaurantes** e **avaliação de qualidade**.
- A usuária escolheu juntar duas ideias: **A**, o copiloto do restaurante, e **C**, o agente de pedidos.

## O produto

Duas telas, uma história só: "o restaurante sobe a foto do cardápio, e o cliente já consegue pedir
daqueles pratos conversando".

1. **Pedir comida** (`/`): chat com um agente que
   - busca pratos e restaurantes num catálogo, com filtros exatos de preço, tempo de entrega, tags,
     rodízio e bairro;
   - lembra preferências e restrições ("sou vegetariana", "não como camarão") e as aplica **no código**
     das ferramentas, não só no prompt;
   - monta um **carrinho simulado**, com um restaurante por pedido, total, taxa de entrega e
     "Finalizar (simulado)";
   - mostra em cada resposta o bloco **"Como a IA pensou"**, com as ferramentas chamadas, os argumentos
     e o resultado resumido;
   - renderiza **cards de pratos** com botão "Adicionar".
2. **Para restaurantes** (`/restaurante`): copiloto em que
   - o dono envia uma **foto do cardápio** ou escolhe um dos exemplos prontos;
   - a IA extrai o **cardápio estruturado** (JSON com schema): nome, descrição, preço, categoria e tags
     (vegetariano, vegano, sem glúten, sem lactose, apimentado). Também **reescreve descrições**
     apetitosas e **sugere combos**;
   - o dono revisa e edita numa tabela, preenche bairro, tempo e taxa, e **publica**;
   - o restaurante publicado aparece no catálogo do chat. Ele fica salvo no navegador (localStorage)
     e é enviado ao servidor junto com cada mensagem.
3. **Evals** (`npm run evals`): cerca de 10 casos com a API real. Verificam se o agente chamou a
   ferramenta certa com os argumentos certos, se respeitou restrições e se montou o carrinho certo.
   Geram uma tabela com a taxa de acerto e a salvam em `evals/RESULTS.md`.

## Decisões (do Claude, a usuária pediu "pode gerar")

- **Modelo**: `GEMINI_MODEL` com default `gemini-3.5-flash-lite`, testado no free tier com function
  calling e JSON schema. `GEMINI_FALLBACK_MODEL` tem default `gemini-3.5-flash`. Em 503 ou timeout,
  tenta o próximo modelo. Em 429 também troca de modelo, porque a cota do free tier é por modelo; se todos falharem, a mensagem diferencia o limite por minuto ("espere 1 minutinho") do limite diário. Cada turno tem prazo total de 45 s, e as rotas têm `maxDuration = 60`.
- **Agente**: loop manual de function calling no servidor, com no máximo 6 passos. Os eventos NDJSON
  são `tool`, `dishes`, `state`, `text`, `error` e `done`. A resposta final não é transmitida em
  streaming, porque o loop precisa da resposta completa. Os passos aparecem ao vivo.
- **Estado sem banco**: as preferências e o carrinho vivem no cliente e vão em cada requisição. O
  servidor devolve o novo estado no evento `state`. Os restaurantes importados ficam em localStorage
  (até 5, com no máximo 80 itens cada).
- **Catálogo seed**: 12 restaurantes **fictícios** em bairros reais de São Paulo, cada um com cerca
  de 8 itens, em `src/data/catalog.ts`.
- **Busca**: por palavra-chave, sem acento e com pontuação por campo (nome > categoria e culinária >
  descrição). A busca semântica com embeddings fica fora, para não gastar cota.
- **Regras no código** (guardrails): restrições filtram os resultados; o carrinho aceita só um
  restaurante; a quantidade vai de 1 a 20; os IDs precisam existir.
- **Imagens**: o cliente redimensiona a foto para até 1600px em JPEG, para ficar abaixo do limite de
  4,5 MB da Vercel. O rate limit da extração é de 8 por hora por IP.
- **Marca**: Garfada. Sem nome ou logo do iFood. O README diz que foi "inspirado em assistentes de
  pedido por conversa".
- **Reaproveitado da v1**: streaming NDJSON, `readEvents`, rate limit, validação, layout, tokens de cor,
  E2E e README (reescrito).
- **Removido**: grounding com Maps (`places.ts`), cards com link do Maps e botão de localização.

## Fora do escopo

Pagamento real, login, banco de dados, voz, busca semântica, painel de vendas do restaurante.

## Anti-objetivos

- O agente sugerir um prato que viola uma restrição declarada.
- O agente inventar um prato ou preço que não está no catálogo.
- A demo quebrar com erro técnico quando o modelo está sobrecarregado ou sem cota.
- A chave da API ir para o navegador.

## Riscos conhecidos

- **Prompt injection via cardápio importado ou preferências**: esses textos entram nos resultados das
  ferramentas e no estado do system prompt. Mitigações: quebras de linha e caracteres de controle são
  removidos na validação; o estado vai como **bloco JSON marcado como dados**; e as regras críticas
  (preço, restrições, carrinho) ficam no código. Num produto com vários usuários, o cardápio publicado
  também passaria por moderação.
- **Restrições por texto**: "evitar" compara radicais (plural ⇄ singular) e alguns grupos ("frutos do mar",
  "peixe"). Sinônimos fora disso não são pegos; um produto real usaria alérgenos estruturados no cardápio.
- **Ações durante a resposta**: os botões que mudam o carrinho ficam desabilitados enquanto o agente responde,
  para o estado do servidor não sobrescrever uma ação do usuário.
- **Free tier instável** (503): o fallback de modelo mitiga.

## Checklist de construção

1. Tipos, catálogo seed, busca e aplicação de restrições (testes unitários).
2. Regras do carrinho e ferramentas do agente: declarações + `executeTool` (testes unitários).
3. Loop do agente com fallback de modelo e erros mapeados (testes com cliente fake).
4. Extração de cardápio: schema, normalização, rota `/api/menu` (testes com cliente fake).
5. Rota `/api/chat` v2 com validação do estado e dos importados (testes).
6. UI do chat: passos "Como a IA pensou", cards de pratos, carrinho e preferências (testes de componente).
7. UI do copiloto: upload ou exemplo, revisão, publicação; imagens de exemplo (testes de componente).
8. Evals com a API real, E2E, screenshots e README.
