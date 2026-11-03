/* ============================================================
   COMPARTILHADO — o que o navegador e o servidor precisam saber igual
   ------------------------------------------------------------
   Carregado no site (index.html, antes de site.js e bible.js) e pelas
   funções de api/ (import "../js/compartilhado.js"). Fica em
   globalThis.SITE_SHARED:
     SITE_NAME, HOME_TITLE  nome do site e título da página inicial
     ROUTE_META             título e descrição padrão de cada página
     ROUTE_BASES            páginas que existem (o resto é "não encontrada")
     PALAVRA_REFS           lista da Palavra Diária (um versículo por dia)
     spToday()              data de hoje em Brasília (AAAA-MM-DD)
     palavraRefFor(iso)     versículo da Palavra Diária daquele dia
   Sem dependências e sem DOM: roda igual no navegador e no Node.
   ============================================================ */
(function (g) {
  const SITE_NAME = "AD Belém - Parque Artur Alvim";
  const HOME_TITLE = "Assembleia de Deus Belém - Parque Artur Alvim | São Paulo";

  const ROUTE_META = {
    home: ["", "Assembleia de Deus Belém - Parque Artur Alvim, São Paulo: horários dos cultos, Bíblia online, eventos, vídeos, departamentos e localização."],
    cultos: ["Horários dos cultos", "Dias e horários dos cultos e da Escola Bíblica Dominical da AD Belém - Parque Artur Alvim."],
    biblia: ["Bíblia", "Leia a Bíblia Sagrada completa no site, gratuitamente, na tradução Bíblia Livre, e abra a mesma passagem na ARC, ARA, NVI, NTLH ou BKJ."],
    biblioteca: ["Biblioteca dos Jovens", "Livros de teologia, história, filosofia e literatura para emprestar: veja o acervo, a situação de cada livro e peça o seu. Aberta a todos."],
    harpa: ["Harpa Cristã", "Os 640 hinos da Harpa Cristã, o hinário das Assembleias de Deus: procure pelo número ou pelo nome e ouça."],
    ebd: ["Escola Bíblica Dominical", "Lição da semana da EBD, referências bíblicas e perguntas para aprofundar o estudo."],
    palavra: ["Palavra Diária", "Um versículo da Bíblia para meditar a cada dia."],
    videos: ["Vídeos e transmissões", "Cultos, estudos e mensagens transmitidos pela AD Belém - Parque Artur Alvim."],
    eventos: ["Eventos", "Congressos, encontros e programações especiais da AD Belém - Parque Artur Alvim."],
    noticias: ["Notícias", "Novidades, acontecimentos e informações da AD Belém - Parque Artur Alvim."],
    sobre: ["Quem somos", "História, missão, valores e liderança da Assembleia de Deus Belém - Parque Artur Alvim."],
    "primeira-visita": ["Sua primeira visita", "Horários, endereço e como chegar para visitar a AD Belém - Parque Artur Alvim pela primeira vez."],
    departamentos: ["Departamentos", "Conheça os departamentos da AD Belém - Parque Artur Alvim."],
    podcast: ["Podcast", "Mensagens e conversas para fortalecer a sua fé, do podcast da AD Belém - Parque Artur Alvim."],
    doacoes: ["Ofertas e doações", "Contribua com ofertas, dízimos e projetos da AD Belém - Parque Artur Alvim via PIX."],
    oracao: ["Pedido de oração", "Envie seu pedido de oração ou fale com a equipe pastoral da AD Belém - Parque Artur Alvim."],
    privacidade: ["Política de privacidade", "Como a AD Belém - Parque Artur Alvim trata seus dados, de acordo com a LGPD."],
  };

  // Primeira parte do endereço de cada página que o roteador (js/site.js) conhece.
  // "home" é a página inicial ("/"); "admin" é o painel.
  const ROUTE_BASES = [...Object.keys(ROUTE_META), "admin"];

  const PALAVRA_REFS = [
    "Salmos 23:1", "João 3:16", "Romanos 8:28", "Filipenses 4:13", "Jeremias 29:11", "Isaías 41:10", "Provérbios 3:5-6",
    "Josué 1:9", "Mateus 11:28", "Salmos 46:1", "2 Timóteo 1:7", "Hebreus 11:1", "1 Coríntios 13:4-7", "Gálatas 5:22-23",
    "Efésios 2:8-9", "Romanos 12:2", "Salmos 119:105", "Mateus 6:33", "Isaías 40:31", "Lamentações 3:22-23", "Salmos 37:5",
    "Filipenses 4:6-7", "1 Pedro 5:7", "João 14:6", "João 14:27", "Romanos 5:8", "Romanos 10:9", "2 Coríntios 5:17",
    "Salmos 91:1-2", "Salmos 121:1-2", "Mateus 5:16", "Miqueias 6:8", "Deuteronômio 31:6", "Salmos 27:1", "Salmos 34:8",
    "Provérbios 18:10", "Isaías 26:3", "Isaías 53:5", "João 1:1", "João 8:32", "João 10:10", "João 11:25", "João 15:5",
    "João 16:33", "Atos 1:8", "Romanos 6:23", "Romanos 8:1", "Romanos 8:38-39", "Romanos 15:13", "1 Coríntios 10:13",
    "1 Coríntios 15:58", "2 Coríntios 12:9", "Gálatas 2:20", "Efésios 3:20", "Efésios 6:10", "Filipenses 1:6",
    "Filipenses 4:19", "Colossenses 3:23", "1 Tessalonicenses 5:16-18", "2 Timóteo 3:16", "Hebreus 4:12", "Hebreus 12:1-2",
    "Hebreus 13:8", "Tiago 1:5", "Tiago 4:8", "1 Pedro 2:9", "1 João 1:9", "1 João 4:8", "1 João 4:19", "Apocalipse 3:20",
    "Apocalipse 21:4", "Gênesis 1:1", "Êxodo 14:14", "Números 6:24-26", "Salmos 1:1-2", "Salmos 16:11", "Salmos 19:14",
    "Salmos 30:5", "Salmos 32:8", "Salmos 51:10", "Salmos 55:22", "Salmos 62:1-2", "Salmos 103:1-2", "Salmos 118:24",
    "Salmos 139:14", "Salmos 145:18", "Provérbios 4:23", "Provérbios 16:3", "Eclesiastes 3:1", "Isaías 9:6", "Isaías 43:2",
    "Isaías 55:8-9", "Jeremias 33:3", "Sofonias 3:17", "Mateus 5:14", "Mateus 7:7", "Mateus 28:19-20", "Marcos 10:27",
    "Lucas 1:37", "João 13:34-35", "Atos 2:42", "Romanos 1:16", "Romanos 12:12", "Efésios 4:32", "Colossenses 3:2",
    "Hebreus 10:23", "1 Pedro 3:15", "2 Crônicas 7:14", "Habacuque 3:17-18", "Joel 2:28", "Salmos 40:1", "Salmos 73:26",
    "Salmos 84:11", "Salmos 100:4-5", "Salmos 127:1", "Provérbios 15:1", "Provérbios 22:6", "Isaías 12:2", "Isaías 54:10",
    "Mateus 22:37-39", "Lucas 6:31", "João 6:35", "João 20:29", "Romanos 3:23-24", "1 Coríntios 16:14", "2 Coríntios 4:16-18",
    "Efésios 5:1-2", "Filipenses 2:3-4", "Colossenses 3:12-13", "1 Timóteo 4:12", "Tiago 1:22", "1 João 3:1",
  ];

  // Data de hoje em Brasília (AAAA-MM-DD), para todo mundo ver o mesmo versículo.
  const spToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

  function palavraRefFor(iso) {
    const day = Math.floor(Date.parse(iso + "T12:00:00Z") / 864e5);
    return PALAVRA_REFS[((day % PALAVRA_REFS.length) + PALAVRA_REFS.length) % PALAVRA_REFS.length];
  }

  g.SITE_SHARED = Object.freeze({ SITE_NAME, HOME_TITLE, ROUTE_META, ROUTE_BASES, PALAVRA_REFS, spToday, palavraRefFor });
})(typeof globalThis !== "undefined" ? globalThis : this);
