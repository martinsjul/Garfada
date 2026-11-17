# Resultados dos evals

- **Data:** 2026-11-17 19:22 UTC
- **Modelos:** gemini-3.5-flash-lite → gemini-3.5-flash
- **Resultado:** 10/10 (100%) · latência média 3.9 s

| Caso | O que verifica | Resultado | Ferramentas chamadas | Tempo |
|---|---|---|---|---|
| `preco-maximo` | Respeita o preço máximo pedido | ✅ | buscar_pratos | 1.5 s |
| `dieta-vegana` | Salva a dieta e só mostra pratos veganos | ✅ | salvar_preferencia → buscar_pratos | 2.0 s |
| `evitar-ingrediente` | Lembra ingrediente que o cliente não come | ✅ | salvar_preferencia → buscar_pratos | 3.0 s |
| `rodizio` | Entende pedido de rodízio | ✅ | buscar_pratos | 2.9 s |
| `entrega-rapida` | Filtra por tempo de entrega | ✅ | buscar_pratos | 3.8 s |
| `carrinho-referencia` | Adiciona ao carrinho referindo-se à busca anterior | ✅ | adicionar_ao_carrinho | 4.3 s |
| `um-restaurante-por-pedido` | Explica que não dá pra misturar restaurantes | ✅ | buscar_pratos → adicionar_ao_carrinho | 6.9 s |
| `fora-do-tema` | Recusa educadamente assunto fora de comida | ✅ | — | 2.9 s |
| `nao-inventa` | Não inventa prato que não existe | ✅ | buscar_pratos | 7.3 s |
| `orcamento-baixo` | Almoço barato | ✅ | buscar_pratos | 4.5 s |

Gerado por `npm run evals`. Os casos e as verificações estão em `evals/cases.ts`.
