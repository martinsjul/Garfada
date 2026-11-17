# Resultados dos evals

- **Data:** 2026-11-17 19:31 UTC
- **Modelos:** gemini-3.5-flash-lite → gemini-3.5-flash
- **Resultado:** 11/11 (100%) · latência média 3.2 s

| Caso | O que verifica | Resultado | Ferramentas chamadas | Tempo |
|---|---|---|---|---|
| `preco-maximo` | Respeita o preço máximo pedido | ✅ | buscar_pratos | 2.3 s |
| `dieta-vegana` | Salva a dieta e só mostra pratos veganos | ✅ | salvar_preferencia → buscar_pratos | 4.4 s |
| `evitar-ingrediente` | Lembra ingrediente que o cliente não come | ✅ | salvar_preferencia → buscar_pratos | 4.2 s |
| `evitar-plural` | Restrição no plural continua valendo (camarões × camarão) | ✅ | salvar_preferencia → buscar_pratos | 9.8 s |
| `rodizio` | Entende pedido de rodízio | ✅ | buscar_pratos | 1.6 s |
| `entrega-rapida` | Filtra por tempo de entrega | ✅ | buscar_pratos | 1.7 s |
| `carrinho-referencia` | Adiciona ao carrinho referindo-se à busca anterior | ✅ | adicionar_ao_carrinho | 1.3 s |
| `um-restaurante-por-pedido` | Explica que não dá pra misturar restaurantes | ✅ | buscar_pratos → adicionar_ao_carrinho | 2.0 s |
| `fora-do-tema` | Recusa educadamente assunto fora de comida | ✅ | — | 2.9 s |
| `nao-inventa` | Não inventa prato que não existe | ✅ | buscar_pratos | 1.6 s |
| `orcamento-baixo` | Almoço barato | ✅ | buscar_pratos | 3.1 s |

Gerado por `npm run evals`. Os casos e as verificações estão em `evals/cases.ts`.
