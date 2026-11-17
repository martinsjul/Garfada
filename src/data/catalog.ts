import type { MenuItem, Restaurant, Tag } from "@/lib/types";

/**
 * Catálogo de demonstração: restaurantes FICTÍCIOS em bairros reais de São Paulo.
 * Preços e itens inventados para o protótipo.
 */
type ItemSeed = [nome: string, descricao: string, preco: number, categoria: string, tags?: Tag[]];

function restaurant(
  id: string,
  info: Omit<Restaurant, "id" | "itens" | "origem">,
  itens: ItemSeed[],
): Restaurant {
  return {
    id,
    origem: "catalogo",
    ...info,
    itens: itens.map(([nome, descricao, preco, categoria, tags = []], i): MenuItem => ({
      id: `${id}-${i + 1}`,
      nome,
      descricao,
      preco,
      categoria,
      tags,
    })),
  };
}

export const CATALOG: Restaurant[] = [
  restaurant("forno-da-vila", { nome: "Forno da Vila", culinaria: "pizzaria", bairro: "Vila Madalena", tempoEntregaMin: 40, taxaEntrega: 6.9, nota: 4.7, rodizio: true }, [
    ["Rodízio de Pizza (por pessoa)", "mais de 30 sabores salgados e doces, à vontade no salão ou kit para 2 no delivery", 69.9, "rodízio", []],
    ["Pizza Margherita", "molho de tomate italiano, mussarela de búfala e manjericão fresco", 52, "pizzas", ["vegetariano"]],
    ["Pizza Calabresa", "calabresa artesanal, cebola roxa e azeitonas", 49, "pizzas"],
    ["Pizza de Camarão", "camarão salteado no alho, catupiry e cebolinha", 79, "pizzas"],
    ["Pizza Vegana de Abobrinha", "abobrinha grelhada, tomate-cereja e queijo de castanha", 58, "pizzas", ["vegano", "vegetariano", "sem_lactose"]],
    ["Pizza Diavola", "salame picante, pimenta calabresa e mel de pimenta", 56, "pizzas", ["apimentado"]],
    ["Pizza de Chocolate com Morango", "chocolate ao leite e morangos frescos", 45, "pizzas doces", ["vegetariano"]],
    ["Refrigerante lata", "350 ml", 7, "bebidas", ["vegano", "vegetariano", "sem_gluten", "sem_lactose"]],
  ]),
  restaurant("sushi-liberdade", { nome: "Sushi Liberdade", culinaria: "japonesa", bairro: "Liberdade", tempoEntregaMin: 30, taxaEntrega: 5.9, nota: 4.6, rodizio: true }, [
    ["Rodízio Japonês (por pessoa)", "sushis, sashimis, temakis e pratos quentes à vontade", 109.9, "rodízio"],
    ["Combo 20 peças", "sushis e sashimis variados de salmão e atum", 74, "combos", ["sem_gluten"]],
    ["Temaki de Salmão", "salmão fresco, cream cheese e cebolinha", 34, "temakis"],
    ["Temaki Vegetariano", "pepino, manga, cenoura e gergelim", 26, "temakis", ["vegano", "vegetariano", "sem_lactose"]],
    ["Yakisoba de Legumes", "macarrão oriental com legumes salteados", 39, "pratos quentes", ["vegetariano", "sem_lactose"]],
    ["Hot Roll de Camarão", "8 peças empanadas com camarão e cream cheese", 36, "hot rolls"],
    ["Missoshiru", "sopa de missô com tofu e cebolinha", 12, "entradas", ["vegano", "vegetariano", "sem_lactose"]],
  ]),
  restaurant("fogo-de-chao-paulista", { nome: "Brasa Paulista Churrascaria", culinaria: "churrascaria", bairro: "Moema", tempoEntregaMin: 50, taxaEntrega: 8.9, nota: 4.5, rodizio: true }, [
    ["Rodízio de Carnes (por pessoa)", "picanha, fraldinha, cupim, linguiça e buffet de saladas", 139, "rodízio", ["sem_gluten"]],
    ["Marmita de Picanha", "picanha fatiada, arroz, farofa e vinagrete", 54, "marmitas"],
    ["Marmita de Frango Grelhado", "filé de frango, arroz, feijão e salada", 36, "marmitas", ["sem_gluten", "sem_lactose"]],
    ["Pão de Alho (4 un.)", "pão de alho cremoso na brasa", 18, "entradas", ["vegetariano"]],
    ["Salada da Casa", "folhas, palmito, tomate e molho de mostarda e mel", 28, "saladas", ["vegetariano", "sem_gluten"]],
  ]),
  restaurant("raiz-vegana", { nome: "Raiz Cozinha Vegana", culinaria: "vegana", bairro: "Pinheiros", tempoEntregaMin: 30, taxaEntrega: 4.9, nota: 4.8, rodizio: false }, [
    ["Bowl de Grão-de-Bico", "grão-de-bico assado, quinoa, legumes e tahine", 38, "bowls", ["vegano", "vegetariano", "sem_lactose", "sem_gluten"]],
    ["Hambúrguer de Cogumelos", "blend de cogumelos, maionese de ervas e batata rústica", 42, "lanches", ["vegano", "vegetariano", "sem_lactose"]],
    ["Feijoada Vegana", "feijão preto com legumes defumados, arroz, couve e farofa", 44, "pratos", ["vegano", "vegetariano", "sem_lactose", "sem_gluten"]],
    ["Lasanha de Berinjela", "berinjela, molho de tomate e ricota de castanha", 46, "pratos", ["vegano", "vegetariano", "sem_lactose"]],
    ["Brownie Vegano", "cacau 70% e nozes", 16, "sobremesas", ["vegano", "vegetariano", "sem_lactose"]],
    ["Kombucha", "300 ml, sabores variados", 14, "bebidas", ["vegano", "vegetariano", "sem_gluten", "sem_lactose"]],
  ]),
  restaurant("cafe-do-largo", { nome: "Café do Largo", culinaria: "cafeteria", bairro: "Centro", tempoEntregaMin: 20, taxaEntrega: 3.9, nota: 4.6, rodizio: false }, [
    ["Café Coado", "grãos especiais da Mantiqueira, 200 ml", 9, "cafés", ["vegano", "vegetariano", "sem_gluten", "sem_lactose"]],
    ["Cappuccino", "espresso, leite vaporizado e canela", 14, "cafés", ["vegetariano", "sem_gluten"]],
    ["Bolo de Cenoura com Chocolate", "fatia generosa com cobertura de brigadeiro", 15, "bolos", ["vegetariano"]],
    ["Bolo de Fubá com Goiabada", "receita de vó, sem glúten", 13, "bolos", ["vegetariano", "sem_gluten"]],
    ["Pão de Queijo (6 un.)", "pão de queijo mineiro quentinho", 16, "salgados", ["vegetariano", "sem_gluten"]],
    ["Combo Café + Bolo", "café coado + fatia de bolo do dia", 21, "combos", ["vegetariano"]],
    ["Misto Quente", "pão de forma, presunto e queijo", 17, "salgados"],
  ]),
  restaurant("bar-do-zeca", { nome: "Bar do Zeca", culinaria: "brasileira", bairro: "Vila Mariana", tempoEntregaMin: 35, taxaEntrega: 5.5, nota: 4.4, rodizio: false }, [
    ["Feijoada Completa", "feijoada com carnes, arroz, couve, farofa, laranja e torresmo (serve 1)", 49, "pratos", ["sem_gluten", "sem_lactose"]],
    ["Feijoada para 2", "feijoada completa para duas pessoas", 89, "pratos", ["sem_gluten", "sem_lactose"]],
    ["Picadinho de Carne", "picadinho, arroz, farofa, banana e ovo", 39, "pratos"],
    ["Bolinho de Bacalhau (6 un.)", "bolinhos crocantes de bacalhau", 32, "petiscos"],
    ["Escondidinho de Mandioca", "carne seca com purê de mandioca gratinado", 42, "pratos", ["sem_gluten"]],
    ["Caipirinha sem álcool", "limão, açúcar e água com gás", 12, "bebidas", ["vegano", "vegetariano", "sem_gluten", "sem_lactose"]],
  ]),
  restaurant("burger-mooca", { nome: "Mooca Burger", culinaria: "hamburgueria", bairro: "Mooca", tempoEntregaMin: 35, taxaEntrega: 5.9, nota: 4.5, rodizio: false }, [
    ["Smash Clássico", "2 smash de 80 g, queijo prato, picles e molho da casa", 32, "burgers"],
    ["Bacon Burger", "blend 180 g, cheddar, bacon crocante e cebola caramelizada", 39, "burgers"],
    ["Burger Picante", "blend 180 g, pepper jack, jalapeño e maionese de chipotle", 38, "burgers", ["apimentado"]],
    ["Veggie Burger", "hambúrguer de grão-de-bico, queijo e salada", 34, "burgers", ["vegetariano"]],
    ["Batata Frita", "porção individual com páprica", 16, "acompanhamentos", ["vegano", "vegetariano", "sem_lactose"]],
    ["Milkshake de Ovomaltine", "500 ml", 22, "sobremesas", ["vegetariano"]],
  ]),
  restaurant("emporio-arabe", { nome: "Empório Damasco", culinaria: "árabe", bairro: "Bela Vista", tempoEntregaMin: 30, taxaEntrega: 4.9, nota: 4.6, rodizio: false }, [
    ["Esfiha de Carne", "massa fina, carne temperada e limão", 7.5, "esfihas", ["sem_lactose"]],
    ["Esfiha de Queijo", "queijo branco e zaatar", 7.5, "esfihas", ["vegetariano"]],
    ["Kibe Frito (4 un.)", "kibe crocante recheado com carne", 22, "salgados", ["sem_lactose"]],
    ["Falafel (6 un.)", "bolinhos de grão-de-bico com molho tahine", 26, "salgados", ["vegano", "vegetariano", "sem_lactose"]],
    ["Prato Árabe Completo", "kafta, arroz com lentilha, homus, tabule e pão sírio", 48, "pratos", ["sem_lactose"]],
    ["Homus com Pão Sírio", "pasta de grão-de-bico com azeite", 24, "entradas", ["vegano", "vegetariano", "sem_lactose"]],
  ]),
  restaurant("marmita-da-ana", { nome: "Marmitaria da Ana", culinaria: "caseira", bairro: "Butantã", tempoEntregaMin: 25, taxaEntrega: 2.9, nota: 4.7, rodizio: false }, [
    ["Marmita Fit de Frango", "frango grelhado, arroz integral, brócolis e cenoura", 24, "marmitas", ["sem_gluten", "sem_lactose"]],
    ["Marmita de Carne de Panela", "carne de panela, arroz, feijão e purê", 27, "marmitas", ["sem_gluten"]],
    ["Marmita Vegetariana", "omelete de espinafre, arroz, feijão e salada", 23, "marmitas", ["vegetariano", "sem_gluten"]],
    ["Strogonoff de Frango", "strogonoff, arroz e batata palha", 26, "marmitas"],
    ["Suco Natural de Laranja", "500 ml", 9, "bebidas", ["vegano", "vegetariano", "sem_gluten", "sem_lactose"]],
  ]),
  restaurant("acai-praia", { nome: "Açaí da Praia", culinaria: "açaí e sorvetes", bairro: "Perdizes", tempoEntregaMin: 20, taxaEntrega: 3.5, nota: 4.5, rodizio: false }, [
    ["Açaí 500 ml", "açaí puro com 3 acompanhamentos à escolha", 26, "açaí", ["vegano", "vegetariano", "sem_gluten", "sem_lactose"]],
    ["Açaí 300 ml com Leite Ninho", "açaí, leite em pó, banana e granola", 21, "açaí", ["vegetariano"]],
    ["Smoothie de Morango", "morango, banana e leite vegetal", 18, "bebidas", ["vegano", "vegetariano", "sem_gluten", "sem_lactose"]],
  ]),
  restaurant("taqueria-augusta", { nome: "Taquería Augusta", culinaria: "mexicana", bairro: "Consolação", tempoEntregaMin: 35, taxaEntrega: 5.9, nota: 4.4, rodizio: false }, [
    ["Tacos al Pastor (3 un.)", "porco marinado, abacaxi, cebola e coentro", 36, "tacos", ["sem_gluten", "sem_lactose", "apimentado"]],
    ["Burrito de Frango", "frango, arroz, feijão, queijo e guacamole", 38, "burritos"],
    ["Burrito Vegano", "feijão preto, arroz, legumes e guacamole", 34, "burritos", ["vegano", "vegetariano", "sem_lactose"]],
    ["Nachos com Guacamole", "tortilhas crocantes, guacamole e pico de gallo", 29, "entradas", ["vegano", "vegetariano", "sem_gluten", "sem_lactose"]],
    ["Quesadilla de Queijo", "tortilha com queijo derretido e jalapeño", 27, "entradas", ["vegetariano", "apimentado"]],
  ]),
  restaurant("trattoria-bixiga", { nome: "Trattoria do Bixiga", culinaria: "italiana", bairro: "Bela Vista", tempoEntregaMin: 45, taxaEntrega: 6.5, nota: 4.7, rodizio: false }, [
    ["Spaghetti à Carbonara", "guanciale, ovo, pecorino e pimenta-do-reino", 58, "massas"],
    ["Fettuccine ao Pesto", "pesto de manjericão, parmesão e pinoli", 52, "massas", ["vegetariano"]],
    ["Lasanha à Bolonhesa", "massa fresca, ragu de carne e bechamel", 56, "massas"],
    ["Nhoque ao Sugo", "nhoque de batata com molho de tomate fresco", 44, "massas", ["vegetariano", "sem_lactose"]],
    ["Risoto de Camarão", "arroz arbóreo, camarão e limão-siciliano", 74, "risotos", ["sem_gluten"]],
    ["Tiramisù", "clássico italiano com café e mascarpone", 24, "sobremesas", ["vegetariano"]],
  ]),
];
