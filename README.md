<p align="center">
  <img src="assets/img/brasao.svg" alt="Brasão da Assembleia de Deus Belém – Parque Artur Alvim" width="120">
</p>

<h1 align="center">Assembleia de Deus Belém – Parque Artur Alvim</h1>

<p align="center">
  Site e app da igreja: cultos, Bíblia, Escola Bíblica, Harpa Cristã, biblioteca, vídeos, pedidos de oração<br>
  e um painel para a equipe cuidar de tudo sem precisar de programador.<br><br>
  <a href="https://www.adbelemparquealvim.org.br"><strong>adbelemparquealvim.org.br</strong></a>
</p>

<p align="center">
  <img src="docs/telas/abertura.jpg" alt="Abertura animada" width="150">
  <img src="docs/telas/inicio-celular.jpg" alt="Página inicial" width="150">
  <img src="docs/telas/biblia.jpg" alt="Leitor da Bíblia" width="150">
  <img src="docs/telas/ebd.jpg" alt="Escola Bíblica Dominical" width="150">
  <img src="docs/telas/harpa.jpg" alt="Harpa Cristã" width="150">
</p>

## O que é

Um site em português, feito para o celular, que reúne a vida da igreja em um só lugar: horários dos
cultos, a Palavra, a lição da Escola Bíblica, os hinos, a biblioteca dos jovens, as transmissões e
os canais de contato. Pode ser **instalado como app** no Android e no iPhone, abre **sem internet**
o que já foi visto e se **atualiza sozinho**. Tudo o que muda no dia a dia (cultos, eventos, avisos,
lições, livros, vídeos, cores) é editado pela equipe num **painel administrativo** em `/admin`.

## O que o site oferece

### Para quem visita

| | |
| --- | --- |
| **Cultos e agenda** | Programação semanal com o **próximo culto calculado sozinho** (inclusive a Ceia do Senhor no 3º domingo do mês, quando a lição da EBD passa para o Culto de Ensino de terça; o aviso "na terça após o 3º domingo do mês, com a lição da EBD" só aparece na segunda e na terça depois desse domingo, até 23:59 de Brasília: `movedNoteActive` em `js/core.js`), eventos, avisos e notícias. Qualquer culto ou evento vai para a agenda do celular (.ics / Google Agenda) com um toque. |
| **Bíblia Sagrada** | Bíblia completa no site (Bíblia Livre), busca por livro ou referência ("Jo 3.16", "Sl 23"), seleção de versículos para copiar, compartilhar ou gerar link, tamanho de letra e tema escuro, "continuar de onde parei" e leitura offline. O botão **Outras versões** abre a mesma passagem na ARC, ARA, NVI, NTLH, BKJ e outras. |
| **Palavra Diária** | Um versículo por dia para meditar, com os dias anteriores. |
| **Modo ouvir** | Lê em voz alta a Bíblia, a lição da EBD, a Palavra Diária e as notícias com a voz do próprio aparelho, com velocidade, destaque do trecho e continuação no próximo capítulo. |
| **Escola Bíblica Dominical** | Lição da semana de cada revista (Adultos, Jovens…), trimestres, texto áureo e leitura em classe com o texto bíblico, leitura diária para marcar, pontos principais, perguntas e link para a lição completa. |
| **Harpa Cristã** | Índice dos 640 hinos com busca por número ou nome, "Meus hinos" no aparelho e atalhos para ouvir e ver a letra. |
| **Biblioteca dos Jovens** | Acervo com busca e categorias, situação de cada livro (disponível, emprestado com data de volta, reservado), sinopse e pedido "Quero este livro" ou "Entrar na fila de espera". |
| **Vídeos e podcast** | Cultos e lives do YouTube atualizados sozinhos, busca e filtros, botão "Ao vivo" e player de podcast que continua tocando enquanto se navega. |
| **Comunidade** | Pedido de oração e contato (chega por e-mail à equipe), primeira visita (horários, endereço, como chegar), departamentos, história e liderança da igreja e ofertas por PIX com QR Code. |
| **Acessibilidade** | Botão com o bonequinho no topo (e link no rodapé): **tamanho da letra** em 4 níveis, **alto contraste**, **parar animações**, **tradutor de Libras** (VLibras, do Governo Federal) e **legendas** automáticas nos vídeos do YouTube. As escolhas ficam no aparelho. Detalhes em [Acessibilidade](#acessibilidade). |
| **App e privacidade** | App instalável (PWA) com atalhos, abertura animada com o brasão montado em formas geométricas (na primeira visita), aviso de versão nova, política de privacidade (LGPD) e conteúdos de terceiros (YouTube, Spotify, Maps) só com permissão. |

<p align="center">
  <img src="docs/telas/inicio-computador.jpg" alt="Página inicial no computador" width="640">
</p>
<p align="center">
  <img src="docs/telas/cultos.jpg" alt="Horários dos cultos" width="150">
  <img src="docs/telas/biblia-versoes.jpg" alt="Outras versões da Bíblia" width="150">
  <img src="docs/telas/palavra.jpg" alt="Palavra Diária" width="150">
  <img src="docs/telas/biblioteca-celular.jpg" alt="Biblioteca dos Jovens" width="150">
</p>

### Para a equipe (painel em `/admin`)

- **Aparência:** cores, logo, foto e textos do topo e a frase da abertura.
- **Página inicial:** liga, desliga e reordena as seções da home.
- **Cultos:** dias e horários, com trocas mensais (ex.: Ceia do Senhor no 3º domingo).
- **Eventos, avisos, notícias, vídeos e podcast:** com publicação agendada e fotos enviadas pelo celular.
- **EBD:** trimestres e lições, com importação automática de títulos, datas e referências bíblicas, revisão e publicação.
- **Biblioteca:** empréstimos com as regras da biblioteca (limite por pessoa, prazo, renovação, suspensão por atraso), fila de espera, mensagens prontas no WhatsApp, acervo com capas, leitores e exportação para planilha.
- **Departamentos, sobre a igreja, primeira visita, igreja e redes, doações (PIX).**
- **Entrada protegida:** e-mail e senha **e** confirmação por e-mail (“Liberar acesso” / “Não fui eu”) a cada login.

## Como é feito

- **HTML, CSS e JavaScript puro**, sem framework e sem etapa de build. O `package.json` tem os
  testes (Playwright, em `devDependencies`) e as três bibliotecas da imagem dos versículos
  (`dependencies`: `satori`, `@resvg/resvg-js` e `jpeg-js`), que só as funções de `api/` usam: o
  `publicar.sh` manda para a Vercel um `package.json` só com elas, e a Vercel instala sozinha.
- **Supabase**: banco Postgres com regras de acesso (RLS) por tabela, login do painel, armazenamento
  de imagens e uma função que busca os vídeos do YouTube.
- **Vercel**: hospedagem, funções do servidor (`api/`) e tarefa agendada diária.
- **Resend** para o e-mail dos pedidos de oração; **Web Speech API** para o modo ouvir;
  **service worker** para o app offline; abertura feita em CSS, SVG e canvas (sem vídeo).

## O que não está neste repositório

O `.gitignore` deixa de fora tudo o que é segredo ou dado da igreja:

- **Chaves e senhas**: ficam só nas variáveis de ambiente da Vercel (`RESEND_API_KEY`, `NOTIFY_TO`,
  `EBD_SYNC_TOKEN`, `CRON_SECRET`, `ADMIN_ACCESS_TOKEN`, `LIB_SHEET_ID`, `LIB_SYNC_TOKEN`,
  `LIB_TRIGGER_KEY`, `NEWS_SYNC_TOKEN`, `GEMINI_API_KEY`). A única chave no código é a **publicável** do Supabase, que é
  pública por natureza (veja "Segurança").
- **Cópias de segurança do banco** (`supabase/backups/`), o projeto ligado ao CLI do Supabase
  (`supabase/.temp/`) e os ids do projeto na Vercel (`.vercel/`, `scripts/vercel-projeto.json`).
- Nomes e telefones da biblioteca e os pedidos de oração nunca ficam em arquivos: estão no banco,
  protegidos por RLS, ou vão direto por e-mail.

## Estrutura

```
index.html            casca da página (carrega CSS, JS e a tela de abertura)
vercel.json           rotas, cabeçalhos de segurança (CSP, HSTS…), cache, funções e agendamento
manifest.webmanifest  app instalável (PWA)
sw.js                 service worker: site abre sem internet
robots.txt, sitemap.xml
api/                  funções do servidor: contato.mjs (e-mail do formulário), ebd-sincronizar.mjs,
                      rotina/[tarefa].mjs (agendadas: EBD, resumo semanal e alertas por e-mail),
                      admin-acesso.mjs e admin-aprovar.mjs (liberação do painel por e-mail) e
                      _lib/ (modelos de e-mail, leitor da EBD, rotina.mjs do resumo e dos alertas)
scripts/publicar.sh   publica na Vercel (carimba a versão para o app se atualizar)
scripts/verificar.mjs checagem automática (sintaxe, arquivos citados, rotas, migrations, segredos)
tests/fumaca.spec.mjs smoke test no navegador (Playwright; playwright.config.mjs e package.json)
.github/workflows/    roda a checagem e o smoke test a cada push
assets/img/           brasão em vetor (brasao.svg), ícones do app, imagem de compartilhamento
data/harpa/           índice da Harpa Cristã (número e título)
assets/fonts/         Fraunces e Inter (hospedadas aqui, sem Google Fonts)
data/bible/blivre/    Bíblia Livre: index.json + um arquivo por livro (veja LICENCA.txt)
vendor/               supabase-js e qrcode-generator em versões fixas (VERSIONS.txt)
css/
  fonts.css base.css intro.css site.css podcast.css extras.css bible.css ebd.css harpa.css
  biblioteca.css admin.css
js/
  intro.js    vinheta de abertura (partículas, frase letra por letra, “Pular”)
  config.js   endereço do site (SITE_URL), URL e chave pública do Supabase, logo padrão,
              config.local.json no computador e a faixa "AMBIENTE DE TESTE"
  core.js     dados padrão, carregamento, cópia offline, helpers, ícones, upload
  site.js     rotas (/cultos, /biblia…), menus, páginas, modais e animações
  podcast.js  páginas do podcast e player fixo
  privacy.js  aviso de cookies (LGPD), bloqueio de YouTube/Spotify/Maps, política
  extras.js   pedido de oração, “adicionar à agenda”, SEO, instalar o app
  bible.js    leitor da Bíblia, referências ("Jo 3.16") e Palavra Diária
  listen.js   modo ouvir: leitura em voz alta com a voz do aparelho
  acessibilidade.js  painel Acessibilidade (letra, contraste, animações, Libras, legendas)
  ebd.js      Escola Bíblica Dominical (páginas públicas)
  harpa.js    Harpa Cristã (índice e hinos)
  biblioteca.js  Biblioteca dos Jovens (acervo e pedidos)
  compartilhado.js  ROUTE_META, páginas que existem e a lista da Palavra Diária (navegador e servidor)
  admin.js    painel (abra /admin) — os admin*.js e o css/admin.css só são baixados em /admin
              (loadAdminAssets em core.js); o site público não carrega nada do painel
  admin-ebd.js  aba EBD do painel (trimestres e lições)
  admin-biblioteca.js  aba Biblioteca do painel (empréstimos, fila, acervo)
  admin-podcast.js  importação dos episódios do Spotify (feed RSS) na aba Podcast
  main.js     inicialização
supabase/     SQL do banco (NÃO é publicado no site): migrations/ tem o baseline (estrutura
              completa) e o que veio depois dele; historico/ guarda os SQL de antes do
              baseline; config.toml é do CLI do Supabase (veja "Mudanças no banco")
docs/telas/   imagens usadas neste README
```

## Endereços

Cada página tem um endereço próprio: `/cultos`, `/eventos`, `/noticias/<slug>`, `/sobre`,
`/primeira-visita`, `/biblia`, `/biblia/joao/3`, `/biblia/joao/3/16-18`, `/harpa`, `/harpa/15`,
`/biblioteca`, `/biblioteca/<id>`, `/podcast/<id>`,
`/privacidade`, `/admin`. Os links antigos com `#` (ex.: `/#eventos`) continuam funcionando e
são convertidos sozinhos. Na Vercel, a regra `rewrites` do `vercel.json` manda todos esses endereços
para a função `api/pagina.mjs`, que devolve o `index.html` com o título e a descrição da página
(veja abaixo). Arquivos que existem são servidos antes, inclusive a página inicial (`/` é o próprio
`index.html`, que já tem o título e a descrição dela).

### Preview no WhatsApp (título e descrição no HTML)

O WhatsApp, o Facebook e o Google não rodam o JavaScript do site, então leem só o `<head>` do HTML.
A função `api/pagina.mjs` pega o `index.html` e troca só o `<title>`, a `description`, o `og:title`,
o `og:description`, o `og:url` e o `canonical` (montados em `api/_lib/paginas.mjs`):

| Rota | De onde vem |
| --- | --- |
| `/biblia/<livro>/<capítulo>[/<versículos>]` | Referência no título e o texto do(s) versículo(s) na descrição, com o crédito da Bíblia Livre (arquivos de `data/bible/blivre`, sem banco) |
| `/palavra`, `/palavra/<data>` | O versículo do dia (mesma lista e mesma regra do navegador), com a **imagem do versículo** na prévia |
| `/noticias/<slug>`, `/eventos`, `/ebd/…` | Supabase com a chave publicável, só leitura (RLS); notícia da sede aponta o `canonical` para o original |
| Demais rotas | `ROUTE_META` |

O `ROUTE_META`, a lista da Palavra Diária e a lista de páginas que existem (`ROUTE_BASES`) ficam em
`js/compartilhado.js`, lido igual pelo navegador e pelo servidor. **Endereço que o site não conhece**
volta com status **404** (com `noindex` e a mesma página "não encontrada"), assim como notícia que não
existe; o roteador do `js/site.js` usa a mesma lista, e o `scripts/verificar.mjs` confere que cada
página dela tem o seu `case` no roteador. Se a função falhar ou demorar mais de
2,5 s, ela devolve o `index.html` original (nunca uma página de erro). Cache curto na Vercel
(`s-maxage=300, stale-while-revalidate`). Ligada desde 03/11/2026 (`"destination":
"/api/pagina?caminho=/$1"` no `rewrites`). Para conferir o que o WhatsApp vê:
`curl -s -A "WhatsApp/2.23" https://www.adbelemparquealvim.org.br/biblia/joao/3/16 | grep -i "og:"`.
Para desligar, volte o `destination` para `/index.html` e publique.

## Abertura (vinheta)

O tipo de abertura é escolhido no `<head>` do `index.html`, antes da primeira pintura:

| Quando | O que aparece |
| --- | --- |
| **Primeira visita do aparelho** (na página inicial) | Vinheta completa de 6 s: ponto de luz e partículas → linhas desenham o contorno do brasão → as formas se encaixam e montam o brasão em vetor → clarão → brilho → nome e frase letra por letra. Dá para pular tocando na tela, no botão "Pular abertura" ou com Esc. |
| **Reabertura na página inicial** | Versão curta (~1,2 s), que termina antes se os dados já chegaram (no mínimo ~0,6 s, para não piscar). |
| **Link direto** para qualquer outra página (ex.: `/biblia/joao/3/16` vindo do WhatsApp, `/palavra`, `/ebd/atual`) | Sem vinheta: tela clara com a barrinha de carregando e um fade rápido (~0,2 s) assim que os dados chegam. |
| **Site recarregou sozinho para entrar uma versão nova** | Versão curta. |
| **"Reduzir movimento"** ligado no aparelho | Tela final parada, sem animação. |

A marca de "já viu a vinheta" fica no aparelho (`localStorage`, chave `intro-vista`); limpar os dados
do site faz a vinheta completa aparecer de novo. Trocar de página dentro do site não repete a abertura.
A frase muda em **Painel → Aparência → Abertura do site**. Tudo é CSS/SVG/canvas, sem vídeo.

## Doações (PIX)

Só aparecem no site as finalidades com chave PIX válida (CPF ou CNPJ com dígitos conferidos,
e-mail, celular ou chave aleatória). Chaves de teste ficam escondidas e o painel mostra o aviso.
O CNPJ só aparece se for válido.

## EBD — Escola Bíblica Dominical

Endereços: `/ebd` (lição da semana e trimestres), `/ebd/atual`, `/ebd/2026/4/adultos` e
`/ebd/2026/4/adultos/3`. **Para ativar**, rode uma vez no Supabase (SQL Editor) o arquivo
`supabase/historico/20261010_ebd.sql` — cria as tabelas `ebd_quarters` e `ebd_lessons` com RLS:
o visitante só lê lições publicadas; só admin (com a entrada liberada) grava.

Como usar (Painel → EBD):
1. **+ Novo trimestre**: ano, trimestre, revista/faixa, tema e data da 1ª lição. As lições são
   criadas sozinhas, uma por domingo, como rascunho.
2. Toda semana o card **Esta semana** mostra a lição da vez: preencha título, texto áureo e
   leitura em classe (só a referência — o texto vem da Bíblia Livre), leitura diária, ideia
   central, pontos principais, perguntas e o link da lição na fonte oficial. **Pré-visualizar**
   mostra a página como vai ficar (só para admins) e **Salvar e publicar** coloca no ar. Também
   dá para agendar a publicação.

Direitos autorais: a estrutura é automática, o conteúdo não. Não copie o texto da revista (CPAD)
nem de sites que a reproduzem; use referências, textos da equipe e links para a fonte oficial.

### Importação automática do sumário (escola-ebd.com.br)

Todo dia às 06:00 (Brasília) a rotina `/api/rotina/ebd` (`api/rotina/[tarefa].mjs`, Vercel Cron) confere o sumário das
Lições Bíblicas em **escola-ebd.com.br** (robots.txt permite; até nov/2026 era estudantesdabiblia.com.br)
para as revistas marcadas no painel (Adultos e/ou Jovens) e completa o trimestre atual — e o
próximo, perto da virada: **tema, comentarista, títulos, datas e referências bíblicas** (texto
áureo, leitura em classe e leitura diária) e o **link de cada lição**. O botão **Sincronizar agora**
(Painel → EBD) faz o mesmo na hora (`ebd-sincronizar.mjs`, só para admin). Nunca sobrescreve o que a
equipe escreveu (só preenche campos vazios; o link do site antigo é trocado pelo do escola-ebd).

**Liberação:** com **Publicar sozinho** ligado, a lição entra no ar **assim que é importada**, sem
esperar o dia. Na lista do trimestre, a lição do domingo leva a etiqueta **"Lição de hoje"** e a
seguinte, **"Próxima lição"**. Lição cujo conteúdo a fonte ainda não publicou aparece com **"ainda não
disponível"**: tocar nela abre um aviso, e o endereço direto mostra a mesma mensagem. No fim de cada
lição, o botão da lição anterior/próxima que ainda não tem conteúdo fica apagado (tracejado, com
"ainda não disponível") e abre o mesmo aviso, sem sair da página (`ebdNavLink` em `js/ebd.js`). Para segurar
uma lição, marque **"Em revisão"** no painel.

**Conteúdo completo (aluno e professor):** o texto da revista é da CPAD (introdução, tópicos, plano de
aula, subsídios), e o escola-ebd o publica inteiro. Reproduzir isso no site da igreja seria copiar a
obra sem autorização (a Lei 9.610/98, art. 46, só permite citar trechos, com crédito). Por isso a
página da lição tem o botão **"Ler a lição completa (aluno e professor)"**, que abre a lição no
escola-ebd, e o site mostra o texto áureo, a leitura em classe e a leitura diária pela Bíblia Livre.
Com autorização por escrito da CPAD, dá para mostrar mais.

O leitor da página de origem fica em `api/_lib/fonte.mjs` — se o layout de lá mudar, é ali que se
ajusta (o endereço de cada revista vem da busca do próprio site, porque não segue um padrão fixo).
Precisa da migration `supabase/migrations/20261108150314_ebd_escola_ebd.sql` (aceita os links do
escola-ebd e libera as lições na hora) e da variável `EBD_SYNC_TOKEN` no Vercel (a chave do servidor;
no banco fica só o hash dela). Educado com a origem: identifica-se no User-Agent, uma requisição por
vez, e só baixa a página de uma lição quando faltam dados dela. Cada chamada baixa poucas lições
e anda por um **cursor** (`after` em `syncQuarter`): o botão continua de onde parou e a rotina
diária começa cada dia de uma lição diferente, então uma lição cuja página nunca traz as três
referências não trava as outras.

## Notícias da AD Belém – Sede

Todo dia às 07:00 (Brasília) a função `api/noticias-sede.mjs` (Vercel Cron) lê as notícias dos
**últimos 30 dias** do site da sede (ad.org.br, pela API pública do WordPress, a mesma do RSS) e
separa as que importam. O filtro (`api/_lib/noticias-sede.mjs`) tira aniversários e homenagens a
pessoas, transições de pastor em outros setores e os boletins diários repetidos ("EBO chega ao 10º
dia"); deixa batismos, Ceia do Senhor, EBD/EBO, missões, Círculo de Oração, congressos, campanhas e
notícias institucionais.

- **Nada vai ao ar sozinho**: as escolhidas aparecem em **Painel → Notícias → Sugestões da AD Belém –
  Sede** com **Publicar** e **Descartar** (descartada não volta). O botão **Buscar agora** faz a
  conferência na hora.
- **Direito autoral**: guarda e mostra só o título, a **data em que a sede publicou**, um resumo
  curto e o link "Ler a notícia completa no site da sede"; o texto completo e as fotos ficam lá. A
  página da notícia aponta o `canonical` para o original. Para usar as fotos, peça autorização à
  comunicação da sede.
- **Banco**: `supabase/migrations/20261019120000_noticias_sede.sql` (colunas `source_id`, `source_url`,
  `source_name` e `dismissed` em `news`, e a função `news_sede_apply`, protegida pela chave do
  servidor). **Variável na Vercel**: `NEWS_SYNC_TOKEN` (no banco fica só o SHA-256).

## Palavra Diária e Modo ouvir

`/palavra` mostra um versículo por dia (lista fixa de 132 referências em `js/bible.js`, texto da
Bíblia Livre, muda à meia-noite de Brasília). Nada é gerado automaticamente.

**Modo ouvir**: botão "Ouvir" na Bíblia, na EBD, na Palavra Diária e nas notícias. Usa a voz do
próprio aparelho (Web Speech API): grátis, sem internet e sem enviar texto a ninguém. Tem
velocidade, escolha de voz, trecho anterior/próximo, destaque do trecho lido, lembra onde parou e,
na Bíblia, continua sozinho no próximo capítulo. Em alguns celulares a voz pausa com a tela
bloqueada (limite do navegador). Pregações em áudio continuam no player do podcast.

## App instalável (PWA)

Atalhos no ícone (toque longo): Palavra Diária, Lição da EBD, Bíblia, Horários e Pedido de oração.
O que já foi aberto fica guardado no aparelho: capítulos da Bíblia, lições da EBD e as informações
públicas do site. As fotos da tela de instalação ficam em `assets/img/screens/`.

**Sinal fraco** (`sw.js`): páginas, CSS e JS tentam a rede primeiro, mas se ela passar de **3 s** o
service worker devolve a cópia guardada e deixa a resposta da rede atualizar o cache por trás (nos 15 s
seguintes, os outros arquivos da página já vêm da cópia, sem esperar de novo). Todas
as páginas usam **uma cópia só** do `index.html` (o conteúdo de cada endereço é montado pelo JS), em
vez de uma cópia por endereço visitado. Página de erro (404, 500) nunca substitui a cópia boa.

**O que cada abertura baixa** (`js/core.js`, `LIST_QUERIES`): a página inicial pede só as colunas que
usa e os itens mais recentes (12 vídeos, 8 episódios, 20 notícias; eventos e avisos que ainda valem),
cerca de 33 KB do banco em vez de 160 KB. A lista completa vem quando a pessoa abre `/videos`,
`/podcast` ou `/noticias` (ou um episódio por link); o painel recebe tudo, inclusive rascunhos e itens
antigos. A cópia offline junta o que a pessoa já viu, então uma lista vista com internet continua
inteira sem internet.

## Bíblia

Texto da **Bíblia Livre** (BLIVRE), © 2018 Diego Santos, Mario Sérgio e Marco Teles, licença
Creative Commons BY 4.0 Brasil, obtido em ebible.org (arquivo VPL), sem alterações no texto.
O crédito aparece em todas as páginas da Bíblia. Os capítulos lidos ficam guardados no aparelho
e abrem sem internet. Letra, tema escuro e "onde parei" ficam só no navegador do visitante.

**Outras versões** (ARC, ARA, NVI, NTLH, BKJ, NAA, NVT, ACF, KJA): têm direitos das editoras, por
isso não são copiadas — o botão "Outras versões" abre a mesma passagem no Bíblia Online, que as
publica com autorização.

## Harpa Cristã

`/harpa`: índice dos 640 hinos (só número e título, `data/harpa/indice.json`, conferido em duas
fontes), busca por número ou nome, "Meus hinos" no aparelho. As letras são da CPAD e não são
reproduzidas: cada hino tem "Ouvir" (busca no YouTube) e "Ver a letra" (site externo).

## Biblioteca dos Jovens

`/biblioteca`: acervo com busca, categorias e a situação de cada livro (disponível, emprestado
com previsão de volta, reservado); página de cada livro com sinopse e o pedido "Quero este livro"
ou "Entrar na fila de espera" (nome + WhatsApp, com consentimento).

- **Banco**: `supabase/historico/20261011_biblioteca.sql` (rodar uma vez no SQL Editor). O
  visitante lê só o acervo (sem o dono do exemplar nem observações) e a situação pela função
  `library_status()`; nomes e telefones de quem pegou ou pediu ficam só para o admin (RLS).
  Pedidos passam por `library_request()`, que valida, evita repetição e limita abusos.
- **Planilha → site (automático)**: a equipe continua cadastrando os livros na planilha do Google.
  `api/biblioteca-sync.mjs` confere a planilha todo dia às 06:30 (Vercel Cron), pelo botão
  **Atualizar agora** do painel ou pelo link da equipe (`/api/biblioteca-sync?chave=…`, mostrado no
  painel). Descobre as abas sozinho (aba nova = categoria nova), cadastra os exemplares novos e guarda
  a capa colada na coluna "Capa" (o Google entrega reduzida, ~25 KB; fica no banco, tabela
  `library_covers`, servida em `/api/capa-livro/<id>-<versão>.jpg`). Livro novo sem imagem na
  planilha ganha capa da internet só quando título e autor batem (Open Library; Google Books se houver
  `GOOGLE_BOOKS_KEY`). Só adiciona: não apaga nem muda o que foi editado no painel; cada livro guarda
  de qual linha veio (`sheet_key`), então corrigir o título no painel não duplica. Livro apagado no
  painel volta se ainda estiver na planilha. Banco: `supabase/historico/20261015_biblioteca_planilha.sql`.
  Variáveis na Vercel: `LIB_SHEET_ID`, `LIB_SYNC_TOKEN`, `LIB_TRIGGER_KEY` (e `CRON_SECRET`).
- **Capas leves**: todas as capas passam pelo redutor de imagens da Vercel (`imgThumb`, ~6 KB na
  lista em vez de ~30 KB), com `srcset` para telas comuns e de alta resolução.
- **Painel → Biblioteca**: resumo (atrasos, vencimentos, pedidos novos), empréstimos com as
  regras da biblioteca (até 2 livros por pessoa, 14 dias, renovação de 7 dias até 2× só sem
  atraso e sem fila, suspensão igual aos dias de atraso), fila de espera, mensagens prontas no
  WhatsApp (lembrete, cobrança, livro disponível), acervo (capa por foto ou busca no Open
  Library), leitores, regras editáveis e exportação para planilha.
- **Importação**: cole o link da planilha antiga no cartão "Importar da planilha" e o painel lê as
  9 abas direto do Google (título, autor, categoria, sinopse, dono, empréstimos em andamento e
  fila). Pode rodar de novo: exemplares que já existem são pulados. O link da planilha não fica no
  código, porque ela tem nomes de quem pegou livros.
- **Capas**: as capas vieram da coluna "Capa" da planilha (imagem original de cada livro), reduzidas
  e guardadas no Storage do site (`images/biblioteca/capas/<id>.jpg`). Para livros novos, use no
  painel "Foto da capa" (foto tirada no celular, já reduzida) ou "Buscar capa" (Open Library).
- Pedidos concluídos ou cancelados são apagados pelo painel depois de 6 meses.

## Segurança

- `js/config.js` usa a chave **publicável** do Supabase. Ela é pública por natureza;
  quem protege os dados são as regras RLS (`supabase/seguranca.sql`): só admin com a
  sessão liberada consegue gravar. Nunca coloque a chave `secret`/`service_role` no site.

### Entrada no painel: senha + liberação por e-mail

Desde `supabase/historico/20261014_admin_acesso.sql`, a senha certa não basta:

1. A pessoa entra em `/admin` com **e-mail e senha** (o e-mail não fica mais no código).
2. O painel chama `api/admin-acesso.mjs`, que confere o login e manda um e-mail
   **“Alguém entrou no painel”** (conta, horário, aparelho, cidade aproximada) com os botões
   **Liberar acesso** e **Não fui eu**, no mesmo estilo do e-mail de pedido de oração.
3. O botão abre `api/admin-aprovar.mjs`, que mostra os dados e pede a confirmação (abrir o link não
   decide nada, então robôs de e-mail que “visitam” links não liberam ninguém).
4. Liberado, a tela do painel continua sozinha. A liberação vale **12 horas** e só para **aquela
   sessão** (o `session_id` do login). O link vale 20 minutos e serve uma vez só.

Quem garante é o banco, não a tela: `public.admins` (lista de admins, ninguém lê pela API) e
`public.is_admin()` = está na lista **e** a sessão foi liberada. `is_site_admin()`, usada em todas as
regras de gravação e do Storage, passou a chamar `is_admin()`. As funções de pedido e decisão só
funcionam com a chave do servidor `ADMIN_ACCESS_TOKEN` (variável da Vercel; no banco fica só o
SHA-256). Limite de 6 e-mails por conta por hora; registros apagados depois de 30 dias.

Quem recebe o e-mail: `ADMIN_APROVADORES` (opcional, e-mails separados por vírgula) ou `NOTIFY_TO`.
Sem domínio verificado, o Resend só entrega para o e-mail da conta Resend.

### Adicionar ou remover um admin

A lista de admins é **só a tabela `public.admins`** (nenhum e-mail fica no código; os e-mails que
aparecem em migrations antigas são histórico). Tudo pelo *SQL Editor* do Supabase:

1. A pessoa precisa ter conta em *Authentication → Users*, com e-mail confirmado (*Add user →
   Create new user* com "Auto Confirm User", ou *Invite user*).
2. Rode o comando trocando o e-mail:

```sql
-- adicionar
insert into public.admins (user_id)
select id from auth.users
 where lower(email) = lower('pessoa@exemplo.com') and email_confirmed_at is not null
on conflict (user_id) do nothing;

-- remover (perde o poder de gravar na hora, mesmo com o painel aberto)
delete from public.admins
 where user_id = (select id from auth.users where lower(email) = lower('pessoa@exemplo.com'));

-- conferir quem é admin hoje
select u.email, a.created_at
  from public.admins a join auth.users u on u.id = a.user_id
 order by u.email;
```

**Podcasts**: até 19/10/2026 a tabela `podcasts` gravava pela conta de um e-mail fixo, sem a
liberação por e-mail (políticas criadas pelo painel do Supabase). A correção
(`supabase/historico/20261019_podcasts_admin.sql`) já foi rodada: conferido em 03/11/2026, a tabela
tem só "Public can read published podcasts" e "Site admin gerencia" (`is_site_admin()`), e nenhuma
regra do banco usa e-mail. Para conferir de novo, só leitura, no SQL Editor:

```sql
select policyname, cmd, roles, qual, with_check
  from pg_policies where schemaname = 'public' and tablename = 'podcasts';
-- e nenhuma regra com e-mail fixo (deve voltar vazio):
select tablename, policyname from pg_policies
 where coalesce(qual, '') || coalesce(with_check, '') ilike '%auth.email%';
```

Tirar alguém de `public.admins` não apaga a conta: para impedir também o login, use *Authentication
→ Users → … → Delete user* (ou *Ban*). Quem **recebe** o e-mail de liberação é outra lista: a
variável `ADMIN_APROVADORES` (ou `NOTIFY_TO`) na Vercel.

**Emergência** (o e-mail não chega e ninguém consegue liberar): entre em `/admin`, deixe na tela
“Confirme pelo e-mail” e rode no *SQL Editor* do Supabase:

```sql
update private.admin_access
   set status = 'permitido', decided_at = now(), approved_until = now() + interval '12 hours'
 where id = (select id from private.admin_access where status = 'pendente' order by created_at desc limit 1);
```

- `vercel.json` define CSP (scripts, estilos e fontes só do próprio site; conexões com o Supabase e,
  só para o painel no navegador, `docs.google.com` (importar a planilha antiga da biblioteca),
  `openlibrary.org` ("Buscar capa") e `anchor.fm` (importar o podcast); iframes só de
  YouTube/Spotify/Google Maps), HSTS, anti-clickjacking e outros. Nada usa o Google Fonts: um nome de
  fonte diferente de Fraunces/Inter no painel usa a fonte do aparelho.
- Bibliotecas ficam em `vendor/` (sem CDN externa). O QR Code do PIX é gerado no
  navegador; nenhum dado vai para serviços de terceiros.
- Uploads do painel aceitam só imagens (até 8 MB) e áudios (até 50 MB).
- Revisão de 2026-10-10: todas as 12 tabelas recusam gravação de visitantes (testado sem alterar
  dados), cadastro público no Supabase Auth está desligado, sem SQL dinâmico com dados externos,
  textos sempre escapados (XSS), links externos com `rel="noopener"`, `safeUrl` recusa
  `javascript:`, `data:` e `//site.com`. O service worker não guarda respostas de funções nem de
  pedidos com login.
- `'unsafe-inline'` no CSP continua necessário por causa dos `onclick` gerados; a proteção contra
  XSS é o escape (`esc`) de todo conteúdo dinâmico.
- **Função `sync-youtube`** (Supabase Edge Function): só aceita o agendamento, que manda o header
  `x-cron-secret` igual ao segredo `CRON_SECRET` **do Supabase** (Edge Functions → Secrets; não é o
  mesmo `CRON_SECRET` da Vercel), ou um admin com a entrada liberada — quem responde é o banco,
  por `public.is_admin()` chamada com o login da pessoa. Qualquer outra chamada recebe 401. Para
  ligar: passo a passo em `supabase/historico/20261019_sync_youtube_segredo.sql` (gerar o segredo,
  `npx supabase@3 secrets set`, rodar o SQL, `npx supabase@3 functions deploy … --use-api`, nessa
  ordem). Na produção, já ligado: conferido em 03/11/2026, o agendamento manda o `x-cron-secret`.

## Acessibilidade

### Painel Acessibilidade (`js/acessibilidade.js`)

Aberto pelo botão do bonequinho no topo (ao lado do "Ao vivo") e pelo link "Acessibilidade" do rodapé.
As escolhas ficam só no aparelho (`localStorage` "acessibilidade") e o `<head>` do `index.html` já as
aplica antes da primeira pintura (a página não "pula"). Pensado para os irmãos idosos, com baixa visão,
surdos e cegos:

- **Tamanho da letra** (Normal, Grande, Maior, Muito grande = 1; 1,15; 1,3; 1,5): todo `font-size` do
  CSS público é `calc(Npx * var(--fs))`. Os títulos grandes usam `--fs-titulo`, que cresce menos de
  propósito, para não estourar a tela do celular. A barra do topo não cresce, mas o menu do celular
  cresce. Testado sem rolagem lateral a 375 e 1280 px. **CSS novo:** escreva o tamanho como
  `font-size: calc(15px * var(--fs));` (ou `--fs-titulo` para títulos de 22 px ou mais).
- **Alto contraste** (`html.a11y-contraste`): textos cinza viram a cor do texto, bordas mais fortes,
  links do texto sublinhados e contorno de foco mais grosso.
- **Parar animações** (`html.a11y-sem-animacao`): o mesmo efeito do "reduzir movimento" do aparelho,
  inclusive a vinheta (fica parada) e as rolagens suaves (`reduceMotion()` em `js/site.js`).
- **Tradutor de Libras (VLibras)**: o plugin do Governo Federal (vlibras.gov.br) só é baixado quando
  a pessoa liga a opção. A partir daí, o botão azul da mãozinha aparece em todas as páginas.
  - Ao ligar, o painel fecha e o intérprete abre.
  - **Com a janela do VLibras aberta, ele segura os toques do site:** tocar num link traduz em
    vez de abrir. É assim em todo site que usa o VLibras. A janela fecha no X dele, ou no próprio
    botão de acessibilidade do topo, que continua funcionando e fecha a janela.
  - Ao desligar a opção, a janela é fechada (`data-active="false"`) antes de ser escondida, para
    os toques voltarem ao site.
  - Os endereços dele estão liberados no Content-Security-Policy do `vercel.json`: `vlibras.gov.br`,
    `*.vlibras.gov.br` e só a pasta `cdn.jsdelivr.net/gh/spbgovbr-vlibras/`.
  - No Safari, alguns ícones da janela do VLibras não aparecem (falha de CORS do próprio VLibras,
    que acontece também numa página vazia); o intérprete funciona.
- **Legendas nos vídeos**: os vídeos do YouTube (vídeos, ao vivo e episódio do podcast) abrem com
  `cc_load_policy=1&cc_lang_pref=pt` (`ytLegendas()`).
- O painel lembra o **Modo ouvir** (leitura em voz alta) e que o site funciona com TalkBack e VoiceOver.
- Os avisos rápidos (toast) ficam na tela o tempo de ler com calma: no mínimo 3 s, mais quanto
  maior a mensagem.

### Auditoria (axe-core, WCAG 2.2 AA)

Em 09/11/2026, as 19 páginas públicas passaram sem nenhum alerta do axe-core, a 375 e a 1280 px,
tanto no modo normal quanto com alto contraste e letra "Muito grande". Para isso:

- O cinza dos textos miúdos (`--c-text-faint`) foi escurecido para contraste ≥ 4,5.
- Os títulos não pulam mais de nível:
  - rodapé em `h2`;
  - cartões em `h3`;
  - `h2` escondido (`sr-only`) nas listas que vinham logo depois do `h1`.
- Os cartões clicáveis (`pressable`) são `div` com `role="button"`.
- No podcast, o título do episódio é o botão; antes havia botão dentro de botão. A linha inteira
  continua clicável.

### Outros cuidados

- **Foco ao trocar de página**: depois de cada navegação interna, o foco vai para o `h1` da página
  (sem contorno), para o leitor de tela anunciar a página nova; sem `h1`, para o `<main>`. Em link de
  versículo ou de doação, vai para o alvo da rolagem. Páginas que carregam o conteúdo depois (Bíblia,
  EBD, Palavra, Harpa, Biblioteca) passam o foco para o `h1` quando ele chega, se a pessoa ainda não
  mexeu. Com uma janela aberta (ex.: episódio do podcast), o foco fica na janela. No carregamento
  inicial o foco não é mexido.
- **Avisos curtos para o leitor de tela**: `aria-live` só em mensagens curtas (contadores da busca,
  "Carregando…", erros). Quando um conteúdo grande chega, uma frase curta vai para a região de status
  `#srStatus` (`announce` em `js/core.js`): "João 3 carregado", "Lição 5 carregada: …", "Hino 15
  carregado: …". As seções da Bíblia, EBD, Palavra, Harpa e Biblioteca não são mais lidas inteiras.
- **Foco visível**: todo elemento focável tem `:focus-visible` com contorno; nos fundos escuros
  (rodapé, cartões azul-marinho, tema escuro da Bíblia) a variável `--focus-ring` deixa o contorno
  branco. Campos sem contorno próprio mostram o anel no contêiner (`:focus-within`).
- **Toque e nomes**: botão "Ao vivo" com nome acessível ("Assistir ao vivo"; no celular o texto fica
  só para o leitor de tela, e aparece na tela quando a transmissão está no ar); links "Saiba mais" com área de toque de ~44 px sem mudar o visual;
  títulos da página inicial sem pular nível (H1 → H2); o app não trava a orientação (tablets podem
  ficar na horizontal).
- Link "Pular para o conteúdo", janelas que prendem o foco e "reduzir movimento" respeitado.

## Privacidade (LGPD)

- O site não usa cookies de rastreamento nem de publicidade.
- **Estatísticas de visitas (Vercel Web Analytics)**, ligadas desde 03/11/2026 (veja abaixo). Sem
  cookies e sem nada guardado no aparelho: contam a página (sem o `?…` e o `#…` do endereço), o
  site de origem, o país e o tipo de aparelho, sistema e navegador. Só rodam no endereço de
  `SITE_URL`: nunca no computador, nos endereços de teste da Vercel nem no painel (aberto direto
  em `/admin`, o script nem carrega; indo do site para o painel, a visita é descartada). Navegador
  com "não rastrear" (*Do Not Track* ou *Global Privacy Control*) não envia nada. A política em
  `/privacidade` ganha o item "Estatísticas de visitas" sozinha quando elas estão ligadas.
- YouTube, Spotify e Google Maps só carregam depois que o visitante permite
  (aviso de cookies; dá para mudar depois em “Preferências de cookies”, no rodapé).
- O **VLibras** (tradutor de Libras, Governo Federal) só carrega quando o visitante liga a opção no
  painel Acessibilidade; a política cita o serviço e o item `acessibilidade` do aparelho.
- A política fica em `/privacidade`. Preencha em **Painel → Igreja & redes** o
  “E-mail para assuntos de privacidade”, que aparece na política.
- **Prazos de guarda automáticos:** `supabase/historico/20261014_lgpd_limpeza.sql` agenda no pg_cron uma
  limpeza diária (pedidos de livros encerrados há 6 meses; registros de entrada no painel com mais de 30 dias).
  Rode no *SQL Editor* do Supabase; sem ele a limpeza só acontece quando o painel é aberto.
- **Como as estatísticas estão ligadas** (feito em 03/11/2026):
  1. Vercel → projeto **assembleia-de-deus-pq-artur-alvim** → aba **Analytics** → **Enable**. A
     Vercel só serve o script **depois da publicação seguinte**. O plano Hobby inclui uma cota
     mensal de eventos; o uso aparece em *Usage*.
  2. `ANALYTICS_SCRIPT: "/_vercel/insights/script.js"` em `js/config.js`. É o caminho padrão para
     site sem framework (o mesmo que o pacote `@vercel/analytics` usa quando não há build). As
     instruções de `npm i @vercel/analytics` que a aba Analytics mostra são para projetos com
     framework e **não se aplicam** aqui: não há nada para instalar.
  3. Conferir: `curl -sI https://www.adbelemparquealvim.org.br/_vercel/insights/script.js`
     responde `content-type: application/javascript`. O caminho `_vercel/` já fica fora do rewrite
     do `vercel.json`, o service worker não guarda nada de lá e o CSP já permite (`script-src 'self'`
     e `connect-src 'self'`: o script e o envio das visitas ficam no próprio endereço do site).
  4. As visitas aparecem na aba Analytics em alguns minutos. Para desligar: `ANALYTICS_SCRIPT: ""`
     e publique (e, se quiser, **Disable** na mesma aba). A política de privacidade acompanha
     sozinha.
- **Pedidos de oração não ficam guardados no site:** `api/contato.mjs` só valida e manda o
  e-mail para a equipe (nada em banco ou em painel de formulários).

## Imagem dos versículos

Quem compartilha a **Palavra Diária** (`/palavra`) ou um **versículo da Bíblia**
(`/biblia/<livro>/<capítulo>/<versículos>`) vê, na prévia do WhatsApp/Facebook, uma imagem com o
texto do versículo, a referência, o brasão e o crédito da Bíblia Livre, em vez do banner padrão.
No site, o botão **"Imagem"** (na Palavra Diária e na barra dos versículos selecionados) abre a
mesma arte no formato de **status/stories** (1080×1920), com "Compartilhar" (manda o arquivo direto,
no celular) e "Baixar".

- **Quem desenha:** `api/imagem.mjs`, na hora, sem banco e sem serviço externo: `satori` monta a
  arte, `@resvg/resvg-js` desenha e `jpeg-js` grava em JPEG (80 a 300 KB; o WhatsApp não mostra
  prévia pesada). As fontes são cópias em TTF das do site (`api/_fontes/`).
- **Fundo:** degradê de uma de 8 paletas (azul da igreja, amanhecer, esmeralda, mar, púrpura, pôr
  do sol, terra, céu da noite), escolhida pelo versículo: o mesmo versículo sai sempre igual, e cada
  dia muda. Para mudar cores ou textos, edite `PALETAS` e `desenho()` em `api/imagem.mjs` e suba
  `IMAGEM_VERSAO` em `js/compartilhado.js` (senão a Vercel e o WhatsApp mostram a imagem antiga).
- **Endereços:** `/api/imagem?palavra=AAAA-MM-DD` ou `/api/imagem?biblia=joao/3/16-17`, com
  `&formato=story` para o vertical. Dia futuro ou referência inválida: 404. A resposta fica em cache
  por muito tempo (o conteúdo de uma data ou referência não muda).
- **WhatsApp guarda a prévia** de cada link por um tempo: um link compartilhado antes desta mudança
  pode continuar mostrando o banner antigo; links novos já vêm com a imagem do versículo.
- No computador (`npx serve`) o botão "Imagem" não aparece: lá não há as funções de `api/`.

## Eventos pelo cartaz ou pelo texto (Gemini) e arte do evento

No painel, aba **Eventos**:

- **"Novo evento pelo texto"**: cole a mensagem de divulgação (a que foi para o grupo do WhatsApp).
  A mesma leitura do cartaz (`api/evento-da-imagem.mjs`, corpo `{ texto }`, até 4.000 letras)
  preenche os campos, e o site **cria a arte do evento** e põe como imagem. Se a arte falhar, o
  evento é criado sem imagem e o cartão avisa.
- **"Gerar arte"** (em cada evento): faz uma imagem nova com o nome, a data, o horário, o local e a
  categoria atuais. Se o evento já tem imagem, pergunta antes de trocar.
- **A arte** (`POST /api/imagem`, só admin liberado): JPEG 1200×750 (16:10, o formato dos cartões
  de evento do site, então nada é cortado) com o brasão, "Assembleia de Deus Belém · Parque Artur
  Alvim", a categoria, o nome do evento, "Sábado, 21 de novembro · 19h30", o local e o endereço do
  site. O fundo é uma das 8 paletas da imagem do versículo, escolhida pelo nome do evento. O texto é
  escrito pelo site (satori), **não por IA**: a geração de imagem do Gemini não está no plano grátis,
  e IA de imagem costuma errar letras e acentos. Nome muito comprido é cortado na última palavra
  inteira, com "…".

O botão **"Novo evento pela imagem"** recebe o cartaz do evento e
preenche sozinho nome, data, horário, categoria, local, endereço, descrição e link de inscrição
(com o link do Google Maps montado a partir do endereço). O evento nasce **desativado**: a equipe
confere e marca **Ativo** para ele aparecer no site. Nos eventos que já têm imagem, **"Preencher
pelo cartaz"** mostra o que vai mudar e só troca depois da confirmação.

- **Quem lê:** o Gemini, do Google, no **plano gratuito** (sem cartão). A função
  `api/evento-da-imagem.mjs` só atende admin com a entrada liberada por e-mail (`is_site_admin`),
  para ninguém de fora gastar a cota. O painel reduz a imagem antes de enviar (lado maior até
  1600 px); a imagem original continua indo para o Storage como antes.
- **Chave:** `GEMINI_API_KEY` na Vercel (criada em aistudio.google.com → *Get API key*). Depois de
  colar ou trocar a chave, publique de novo (`bash scripts/publicar.sh`): a Vercel só entrega a
  variável nova às publicações seguintes. Sem a chave, o botão avisa que falta configurar.
- **Modelos:** `gemini-3.5-flash-lite` (o que mais responde no plano grátis), depois `gemini-3.6-flash`, `gemini-3.8-flash` e uma segunda chance do primeiro
  (`api/_lib/cartaz.mjs`): o plano grátis responde "sobrecarregado" (503) com frequência, então a
  função passa para o próximo, dentro de um prazo total de ~52 s. A leitura leva de 10 s a 1 min.
  Para pôr outro modelo na frente, defina `GEMINI_MODEL` na Vercel.
- **Privacidade:** no plano grátis, o Google usa o que recebe para melhorar os produtos dele e
  pessoas podem revisar o material (sem ligar à conta). Por isso o recurso é só para **cartazes de
  evento**, que já são públicos. Nunca use para pedidos de oração ou dados de pessoas.
- **Limites:** o plano grátis tem cota por minuto e por dia; passando dela, o evento é criado só
  com a imagem e o cartão explica o motivo. A IA pode errar (ano que não aparece no cartaz,
  letra muito decorada); os avisos dela aparecem no cartão do evento. Código QR não é lido.

## Resumo semanal e alertas por e-mail

Tudo numa função só, `api/rotina/[tarefa].mjs` (o plano grátis da Vercel aceita no máximo 12
funções), com as peças em `api/_lib/rotina.mjs`:

| Rotina | Quando (Brasília) | O que faz |
| --- | --- | --- |
| `/api/rotina/ebd` | todo dia 06:00 | importa as lições da EBD (antes era `api/ebd-sync-diario.mjs`) |
| `/api/rotina/resumo` | segunda 07:00 | e-mail **Resumo da semana** |
| `/api/rotina/alertas` | todo dia 09:00 | e-mail **Aviso do site**, se algo parou |

(O Vercel Cron do plano grátis pode disparar em qualquer minuto daquela hora.)

**Resumo da semana:**

- **Precisa da sua atenção:**
  - eventos desativados esperando conferência;
  - notícias da sede esperando aprovação;
  - pedidos novos da biblioteca;
  - livros atrasados, com o link **Cobrar no WhatsApp** já com a mensagem pronta (a mesma do painel);
  - o que estiver nos alertas.
- **Esta semana na igreja:** eventos dos próximos 7 dias e avisos no ar.
- **Biblioteca:** livros que vencem na semana, com o link **Lembrar no WhatsApp**.
- **EBD de domingo:** cada revista com a lição publicada, sem conteúdo ou não cadastrada.

**Alertas:**

- uma rotina (EBD, biblioteca pela planilha, notícias da sede) **falhou 2 vezes seguidas** ou não
  roda há mais de 2 dias (cada uma anota como foi com `registrarRotina`);
- **nenhum vídeo novo do YouTube há 4 dias**;
- de quinta a sábado: **lição de domingo** não cadastrada, sem conteúdo ou não publicada.

O e-mail de alerta só sai quando a lista muda ou depois de 3 dias igual, e um último e-mail avisa
quando tudo voltou ao normal. Se o site inteiro sair do ar, quem avisa é o monitor do GitHub
(`.github/workflows/monitor.yml`), que abre um issue; o GitHub manda e-mail ao dono do repositório.

**Testar:** Painel → **Igreja & redes** → **Enviar o resumo agora** / **Testar o alerta** (o de
alerta sai marcado como `[Teste]` e manda o estado de agora mesmo sem novidade).

**Configuração:**

- **Banco:** `supabase/migrations/20261111120000_rotina_resumo_alertas.sql`, colado no SQL Editor.
  Ele cria:
  - a chave `private.rotina_key` (só o hash);
  - `private.rotina_status`;
  - `rotina_registrar` e `rotina_painel`, só com a chave, só leitura dos dados.
- **Vercel:**
  - `ROTINA_TOKEN`: a chave; o hash está na migration.
  - `RESUMO_PARA` (opcional): e-mails separados por vírgula. Sem ela, vai para `ADMIN_APROVADORES`
    ou `NOTIFY_TO`.
  - E as que já existiam: `RESEND_API_KEY` e `CRON_SECRET`.
- **Sem a migration ou sem `ROTINA_TOKEN`:** o resumo e os alertas respondem explicando o que falta.
  As outras rotinas seguem normais, só sem anotar como foram.

**Para não cair no spam:**

- **O que já está feito:**
  - o remetente é `site@adbelemparquealvim.org.br`, um domínio verificado no Resend;
  - os registros DKIM (`resend._domainkey`), SPF (`send`) e DMARC (`_dmarc`) estão no registro.br;
  - os e-mails têm HTML simples e versão em texto puro;
  - não levam imagem nem anexo nem link encurtado;
  - o assunto é sem caixa alta.
- **O que falta, do lado de quem recebe:** adicionar o remetente aos contatos e, se o primeiro cair
  no spam, marcar "Não é spam". No Gmail, dá para criar um filtro "Nunca enviar para o spam" para
  esse remetente.

## Ao vivo agora

Enquanto a igreja transmite no YouTube, o botão **"Ao vivo"** do topo fica **vermelho e pulsando**,
em todas as páginas, para quem chega no site sem saber que o culto está no ar. No celular, onde o
botão normal é só o ícone, aparece também o texto "Ao vivo". Tocando nele, abre o vídeo da
transmissão dentro do site.

- **Como o site sabe:** `/api/dados?o=ao-vivo` (em `api/dados.mjs`) abre a página `/live` do canal (o mesmo
  `church.liveChannelId` da aba *Igreja & redes*) e lê se o vídeo de lá está no ar
  (`api/_lib/aovivo.mjs`, sem chave de API). Transmissão **agendada**, que já **terminou** ou de
  **outro canal** não acende. Na dúvida (YouTube fora do ar, página diferente), o botão fica normal.
- **Quanto consulta:** o site pergunta ao abrir e a cada 2 min, só com a aba visível. A resposta
  fica 1 min no cache da Vercel, então o YouTube é consultado no máximo 1 vez por minuto, não
  importa quantas pessoas estejam no site.
- **Acessibilidade:** o pulso é lento (1,6 s, longe do limite de 3 piscadas por segundo); com
  "reduzir movimento" no aparelho, o botão fica vermelho e parado. O leitor de tela ouve "Ao vivo
  agora: <título>" no botão e, se a transmissão começar com a pessoa no site, "A transmissão ao
  vivo começou". Branco sobre o vermelho `#c8102e`: contraste 5,9:1.
- **No computador** (`npx serve`) não consulta: lá não há as funções de `api/`.
- **Se um dia parar de acender:** o YouTube pode mudar a página. Confira
  `https://www.adbelemparquealvim.org.br/api/dados?o=ao-vivo` durante uma transmissão (deve
  dizer `"aoVivo":true`). A saída mais firme, se precisar, é a API oficial do YouTube (chave
  gratuita no Google Cloud, consulta `videos.list` dos vídeos do feed).

## Automações

| O quê | Como funciona |
| --- | --- |
| Lives e vídeos do YouTube | O Supabase lê o canal a cada 10 min e adiciona os vídeos novos |
| Botão "Ao vivo" vermelho | Enquanto a igreja transmite, o botão do topo fica vermelho e pulsando (veja "Ao vivo agora") |
| Próximo culto na home | Calculado sozinho a partir dos horários cadastrados |
| Avisos e eventos | Somem sozinhos depois da data final |
| Notícias e podcast agendados | Publique com data futura: aparecem sozinhos no dia |
| Pedidos de oração | Vão direto por e-mail para a equipe, com a identidade da igreja (nada fica guardado) |
| Lições da EBD | Vercel Cron todo dia às 06:00 (`/api/rotina/ebd`) |
| **Resumo da semana por e-mail** | Toda segunda às 07:00 (`/api/rotina/resumo`): veja [Resumo semanal e alertas](#resumo-semanal-e-alertas-por-e-mail) |
| **Alerta quando algo para** | Todo dia às 09:00 (`/api/rotina/alertas`), por e-mail |
| Notícias da sede | Vercel Cron todo dia às 07:00 (`api/noticias-sede.mjs`): sugestões no painel, a equipe publica |
| Versão nova do app | O site confere `/version.json` ao voltar para o app e oferece “Atualizar” |

**E-mail dos pedidos:** a função `api/contato.mjs` recebe o formulário, barra robôs (campo-isca,
envio rápido demais, limite por endereço), monta o e-mail com o modelo `api/_lib/pedido-oracao.mjs`
(texto e versículo conforme o assunto, botão de WhatsApp) e envia pelo Resend (resend.com).
Variáveis na Vercel (*Settings → Environment Variables*): `RESEND_API_KEY`, `NOTIFY_TO`
(e-mails separados por vírgula: a secretaria), `EBD_SYNC_TOKEN`, `CRON_SECRET`, `ADMIN_ACCESS_TOKEN` e,
opcionais, `NOTIFY_PASTOR` (o assunto **"Quero conversar com um pastor" vai só para ele**; sem a
variável, vai para `NOTIFY_TO`), `NOTIFY_FROM` e `ADMIN_APROVADORES`.
O brasão vai anexado ao e-mail (imagem `cid:`, arquivo
`assets/img/logo-email.png`) para aparecer mesmo quando o Gmail bloqueia imagens de fora. O assunto
leva data e hora para o Gmail não juntar pedidos diferentes na mesma conversa.
O domínio `adbelemparquealvim.org.br` está **verificado no Resend** (09/11/2026; registros
`resend._domainkey`, `send`, `rsend` e `_dmarc` no registro.br): os e-mails saem de
`site@adbelemparquealvim.org.br` (`REMETENTE` em `api/_lib/site.mjs`) e chegam para qualquer
endereço. Para trocar a secretaria ou o pastor, mude `NOTIFY_TO` / `NOTIFY_PASTOR` na Vercel e
publique de novo.

## Recriar o banco do zero

`supabase/migrations/00000000000000_baseline.sql` tem a **estrutura completa** do banco, sem nenhum
dado: as 24 tabelas, chaves e índices, as 23 funções, triggers, RLS e políticas, permissões por
tabela, coluna e função, o bucket `images` com as regras dele e os agendamentos do pg_cron. Foi
tirado do banco de produção em 19/10/2026 e conferido: aplicado num Postgres do Supabase vazio,
ficou **idêntico à produção** em colunas, restrições, índices, funções, triggers, RLS e
permissões. A única diferença é proposital: as regras de `podcasts`, que já vêm corrigidas (veja
`20261019_podcasts_admin.sql`).

`supabase/migrations/` tem só o que um banco novo precisa, na ordem: o baseline e as migrations
criadas depois dele (a partir de `20261019120000_noticias_sede.sql`). Os SQL de antes do baseline
(rodados à mão no SQL Editor de 02/10 a 19/10/2026) estão em `supabase/historico/`, só para
consulta: num banco novo, eles não precisam ser rodados.

Passo a passo (ex.: um projeto de teste):

1. Em supabase.com, **New project** (região São Paulo). Guarde a URL e as chaves em *Settings →
   API Keys*.
2. **SQL Editor**: cole o `00000000000000_baseline.sql` inteiro e clique em **Run**. Ele roda numa
   transação só; se der erro, nada fica pela metade. Os blocos 10 (chaves do servidor) e 11
   (agendamento do YouTube) só avisam enquanto os `<...>` não forem trocados; dá para rodá-los
   depois, só aquele trecho. Depois, o resto pelo CLI (veja "Mudanças no banco"): marque o
   baseline como aplicado e rode as migrations seguintes.

   ```bash
   npx supabase@3 migration repair --status applied 00000000000000 --remote=<ref>
   npx supabase@3 db push --remote=<ref>
   ```
3. **Authentication → Sign In / Providers**: desligue *Allow new users to sign up*.
   **Authentication → URL Configuration**: *Site URL* e *Redirect URLs* do endereço do site.
4. **Admins**: crie as contas em *Authentication → Users* e coloque-as em `public.admins` (veja
   "Adicionar ou remover um admin").
5. **YouTube**: `npx supabase@3 secrets set CRON_SECRET=<segredo> --remote=<ref>` e
   `npx supabase@3 functions deploy sync-youtube --remote=<ref> --use-api` (antes, uma vez:
   `npx supabase@3 login`); depois rode o bloco 11 do baseline com a URL do projeto, a chave anon e
   o segredo.
6. **Apontar o site**: localmente, pelo `js/config.local.json` (veja "Rodar localmente"). As funções
   de `api/` leem as variáveis de ambiente `SUPABASE_URL` e `SUPABASE_KEY` (sem elas, a produção;
   veja `api/_lib/fonte.mjs`).

Não entram no baseline (refaça à mão num projeto novo): dados, contas, arquivos do Storage,
segredos e as configurações do painel do Supabase dos passos 3 e 5. **Nunca rode o baseline no
projeto de produção**: o primeiro comando (`create schema private`) falha lá e nada é aplicado.

## Mudanças no banco (migrations)

Toda mudança de estrutura (tabela, coluna, função, regra RLS, agendamento) vira um arquivo em
`supabase/migrations/` e entra no banco pelo CLI do Supabase. Assim o repositório e o histórico do
Supabase (*Database → Migrations*) contam a mesma história, e um banco novo sai igual à produção.

**Use a versão 3 do CLI** (`npx supabase@3 …`, baixa na hora; uma vez: `npx supabase@3 login`).
Nela, `db push`, `migration list` e `migration repair` vão no banco **local** quando ninguém diz
outro; o remoto só com `--remote=<ref>`. Na versão 2 o padrão era o projeto ligado, e neste
computador o projeto ligado é a **produção** (`supabase/.temp/`). Já `secrets` e
`functions deploy` usam o projeto ligado mesmo na versão 3: passe sempre `--remote=<ref>`. O CLI
pede a senha do banco (*Settings → Database*); dá para passar com `--password` ou com a variável
`SUPABASE_DB_PASSWORD`.

`supabase/config.toml` é do CLI e do banco local (`npx supabase@3 start`, precisa do Docker). Nada
dele vai para a produção sozinho. Não rode `supabase config push`.

**Fluxo de uma mudança**

1. Crie o arquivo (o nome ganha data e hora):

   ```bash
   npx supabase@3 migration new nome_curto
   ```

   Escreva o SQL em `supabase/migrations/<data-hora>_nome_curto.sql`. Prefira o que pode rodar de
   novo sem estrago (`if not exists`, `create or replace`, `drop policy if exists` antes do
   `create policy`).
2. Teste num projeto de teste (crie com "Recriar o banco do zero"):

   ```bash
   npx supabase@3 db push --remote=<ref-do-teste> --dry-run   # mostra o que vai rodar
   npx supabase@3 db push --remote=<ref-do-teste>
   ```

   Abra o site no computador apontando para ele (`js/config.local.json`, veja "Rodar localmente") e
   confira o que mudou, inclusive o painel.
3. Produção, depois de testado:

   ```bash
   npx supabase@3 migration list --remote=rtludbkopxbhiwlwycid            # o que falta
   npx supabase@3 db push --remote=rtludbkopxbhiwlwycid --dry-run         # só o arquivo novo?
   npx supabase@3 db push --remote=rtludbkopxbhiwlwycid
   npx supabase@3 migration list --remote=rtludbkopxbhiwlwycid            # local e remoto iguais
   ```
4. Commit do arquivo e `git push`. O `node scripts/verificar.mjs` (e o GitHub Actions) recusa nome
   fora do padrão do CLI ou versão repetida em `supabase/migrations/`.

Evite mexer na estrutura direto no SQL Editor da produção: o que entra por fora não fica no
histórico, e o próximo `db push` não sabe dele. Se precisar (emergência), guarde o mesmo SQL numa
migration nova e marque-a como aplicada, sem rodar de novo:
`npx supabase@3 migration repair --status applied <versão> --remote=rtludbkopxbhiwlwycid`.

### Alinhar a produção ao baseline (uma vez só; você roda)

Hoje o histórico da produção não conhece nenhum arquivo daqui. Ele tem só duas entradas antigas,
de mudanças feitas pelo painel do Supabase em 03/10/2026:

| Versão | Nome |
| --- | --- |
| `20261003005750` | `youtube_sync` |
| `20261003024901` | `is_site_admin_dois_emails` |

O banco em si **já está igual** ao baseline mais `20261019120000_noticias_sede.sql` (conferido em
03/11/2026: as colunas e a função das notícias da sede existem, as regras de podcasts são as do
baseline e o agendamento do YouTube usa o segredo). Falta só a lista. Os comandos abaixo mexem
**só nessa lista** (a tabela `supabase_migrations.schema_migrations`): não rodam o SQL dos
arquivos e não mudam tabela, dado nem permissão.

```bash
npx supabase@3 login
npx supabase@3 migration list --remote=rtludbkopxbhiwlwycid
#   antes: 20261003005750 e 20261003024901 só no remoto; 00000000000000 e 20261019120000 só no local

# tira da lista as duas entradas antigas (o que elas fizeram está no baseline)
npx supabase@3 migration repair --status reverted 20261003005750 20261003024901 --remote=rtludbkopxbhiwlwycid

# marca como aplicados o baseline e as notícias da sede (já estão no banco)
npx supabase@3 migration repair --status applied 00000000000000 20261019120000 --remote=rtludbkopxbhiwlwycid

npx supabase@3 migration list --remote=rtludbkopxbhiwlwycid
#   depois: 00000000000000 e 20261019120000 nas duas colunas, nada sobrando
npx supabase@3 db push --remote=rtludbkopxbhiwlwycid --dry-run
#   precisa dizer que não há nada para aplicar
```

Se o `migration list` de antes mostrar outra coisa, ou se o `db push --dry-run` do fim quiser
aplicar algum arquivo, pare e não rode `db push`: o baseline rodado na produção falharia logo no
primeiro comando (`create schema private`) e nada seria aplicado, mas é sinal de que a lista não
ficou certa.

## Rodar localmente

> 🔒 **No computador, o painel abre em modo só leitura quando o banco é o de PRODUÇÃO.** Sem
> `js/config.local.json` (ou com ele apontando para a produção), dá para entrar no painel e ver tudo,
> mas nenhuma gravação sai do navegador: salvar, apagar, enviar arquivo, sincronizar, o pedido de
> oração e o "Quero este livro" param com o aviso **"Computador em modo só leitura: nada foi gravado
> na produção"**. A faixa vermelha no topo diz **"COMPUTADOR NO BANCO DE PRODUÇÃO · SÓ LEITURA"**.
> O login e a liberação do painel por e-mail continuam funcionando. O site publicado não muda nada.

**Para testar gravando**, aponte para um projeto de teste do Supabase (crie com o baseline, veja
"Recriar o banco do zero"):

1. Copie `js/config.local.example.json` para `js/config.local.json` (esse arquivo fica fora do
   git e nunca é publicado).
2. Preencha `SUPABASE_URL` e `SUPABASE_KEY` (a chave **publicável**, `sb_publishable_…`) do projeto
   de teste.
3. Recarregue a página: a faixa fica amarela, **"AMBIENTE DE TESTE · banco <projeto>"**, e tudo
   grava nesse projeto.

**Para gravar na produção a partir do computador** (só quando for preciso mesmo), o
`js/config.local.json` precisa dizer isso com todas as letras:

```json
{ "PERMITIR_GRAVAR_PRODUCAO": true }
```

A faixa vermelha muda para **"ATENÇÃO: COMPUTADOR GRAVANDO NO BANCO DE PRODUÇÃO"**. Tudo o que for
salvo assim muda o site no ar. Apague a linha (ou o arquivo) quando terminar.

O arquivo só é lido em `localhost`/`127.0.0.1`; no site publicado ele é ignorado mesmo se existir.
Se o arquivo tiver erro, ele é ignorado (volta o modo só leitura na produção). O CSP do
`vercel.json` só libera o projeto de produção, então use o `npx serve` abaixo (sem esses
cabeçalhos) para o banco de teste.

```bash
npx serve -s . -l 5500
# abra http://localhost:5500  (painel: http://localhost:5500/admin)
```

O `-s` faz qualquer endereço (ex.: `/biblia/joao/3`) abrir o `index.html`, como na Vercel.

O formulário de oração, a liberação do painel e as sincronizações (EBD, biblioteca, notícias da
sede) usam as funções de `api/`; localmente use `npx vercel dev` para testá-las. Elas leem
`SUPABASE_URL` e `SUPABASE_KEY` do ambiente (a chave **publicável**) e, sem elas, usam a produção.
Para o projeto de teste, ponha as duas variáveis num arquivo `.env` (fora do git) antes do
`npx vercel dev`.

## Publicar

```bash
bash scripts/publicar.sh          # produção
bash scripts/publicar.sh teste    # endereço de teste, sem mexer no site no ar
bash scripts/publicar.sh montar   # só monta a pasta e mostra onde (não publica nada)
SITE_URL=https://xxx.org.br bash scripts/publicar.sh   # produção com o domínio próprio
```

O script monta uma pasta só com o que é público (`index.html`, `css`, `js`, `vendor`, `assets`,
`data`, `manifest.webmanifest`, `sw.js`, `robots.txt`, `sitemap.xml`, `vercel.json`) e as funções
de `api/`, carimba a versão (data e hora) em `js/config.js`, `sw.js` e `version.json` e publica
pela Vercel CLI. Não é preciso mexer em `CACHE_VERSION` à mão.

O site antigo no Netlify ficou só redirecionando para o endereço novo.

## Checagem automática

A cada push, o GitHub Actions (`.github/workflows/check.yml`) roda `scripts/verificar.mjs`, que:

- confere a sintaxe de `js/*.js`, `sw.js` e `api/**/*.mjs` (`node --check`);
- confere se todo arquivo citado no `index.html`, na lista do `sw.js` e no `manifest.webmanifest`
  existe, e também os `/js/…` e `/css/…` escritos no próprio JS (ex.: o painel, carregado sob
  demanda); o `version.json` fica de fora: é gerado na publicação;
- confere se a lista de páginas de `js/compartilhado.js` bate com o roteador de `js/site.js`;
- confere os nomes em `supabase/migrations/` (formato do CLI, sem versão repetida, baseline
  primeiro);
- confere que `api/` tem no máximo **12 funções** (limite do plano grátis da Vercel por publicação;
  acima disso a Vercel recusa a publicação inteira). Arquivos e pastas com `_` (como `_lib`) não contam;
- procura segredos nos arquivos do git: chave secreta do Supabase (`sb_secret_…`), JWT com papel
  `service_role`, `service_role` com valor, blocos `-----BEGIN …` e arquivos `.env`.

Se algo falhar, o push aparece com ❌ no GitHub e a lista do que corrigir fica no log. Para rodar
antes de publicar: `node scripts/verificar.mjs` (só precisa de Node e git, sem instalar nada).

### Smoke test no navegador (Playwright)

Depois da checagem, um segundo job (`fumaca`) abre o site num Chromium de verdade, no **celular
(375 px)** e no **computador (1280 px)**, e confere `/`, `/cultos`, `/biblia/joao/3`, `/palavra`,
`/ebd`, `/harpa`, `/biblioteca`, `/videos`, `/podcast` e `/privacidade`:

- cada página mostra o `h1` certo e não vira "Página não encontrada";
- nenhum erro no console nem erro de JavaScript (falha de arquivo de **terceiros**, como a
  miniatura de um vídeo removido do YouTube, não conta);
- link direto na primeira visita abre sem vinheta e nada fica na frente da página; no início, a
  vinheta completa aparece só na primeira vez e depois vem a curta.

É **só leitura**: nenhum formulário, nenhum "Quero este livro", nada do painel. Os dados vêm do
banco de produção pela internet, em `localhost`, então o modo só leitura do `js/config.js` já
barra qualquer gravação, e o teste ainda falha se alguma for tentada. Quando falha no GitHub, o
relatório (com foto da tela) fica em *Actions → a execução → Artifacts → relatorio-playwright*.

No computador (Node 22 ou mais novo):

```bash
npm ci                              # uma vez (instala o Playwright e o serve do package.json)
npx playwright install chromium     # uma vez (baixa o navegador)
npx playwright test                 # sobe o npx serve -s . -l 5500 sozinho (ou usa o que já estiver na 5500)
npx playwright test --project=celular    # só no celular
npx playwright show-report          # relatório da última execução
```

Os testes ficam em `tests/fumaca.spec.mjs` e a configuração em `playwright.config.mjs`. Página nova
no site: acrescente a rota na lista `ROTAS` do teste.

### Teste de carga (k6) e alerta de lentidão

**Cache do que todo mundo pede igual.** Ao abrir o site, cada visitante fazia 9 consultas ao
Supabase (configurações, cultos, eventos, vídeos, notícias, podcasts…), todas iguais para todo
mundo. Agora o site pede um pacote só, `/api/dados` (`api/dados.mjs`), que fica **1 minuto no cache
da Vercel**: mil pessoas viram ~1 consulta por minuto ao Supabase. Se o pacote falhar, o site faz as
consultas diretas de sempre. O painel continua lendo tudo fresco; uma mudança feita nele aparece
para os visitantes em até ~1 minuto. (Também ficam no cache: as páginas, 5 min; o "ao vivo", 1 min;
as imagens de versículo, sem prazo.)

**O teste** (`tests/carga/visitante.js`): cada "pessoa" abre uma página (mais o início, os cultos e
a Palavra), busca os dados, confere o "ao vivo" e "lê" de 8 a 20 s antes da próxima. Não grava
nada. Ele **para sozinho** se passar de 5% de erros ou se 95% das respostas passarem de 5 s.

| Quando | O quê | Onde |
| --- | --- | --- |
| **A cada publicação** | 20 pessoas por 30 s no site recém-publicado; se achar lentidão ou erro, o `publicar.sh` avisa em destaque (e mostra como voltar à versão anterior: `npx vercel rollback`). Pule com `SEM_TESTE_CARGA=1`. | `scripts/publicar.sh` |
| **Quando quiser** (ex.: antes de um evento grande) | Sobe aos poucos até 1000 pessoas (ou o número que escolher) e segura 2 min; relatório com gráfico nos *Artifacts* da execução. | GitHub → **Actions → "Teste de carga" → Run workflow** |
| **A cada 30 min** | Visita de teste (início, Palavra, dados, ao vivo). Erro ou mais de 2,5 s abre o aviso **"⚠️ Site lento ou fora do ar"** nas *Issues* — o GitHub manda **e-mail**. Quando volta ao normal, ele comenta e fecha sozinho. | `.github/workflows/monitor.yml` + `tests/carga/sonda.js` |

**Cuidado com a cota.** O plano grátis da Vercel tem **1 milhão de requisições** e 100 GB de
tráfego por mês, e quem estoura fica **até 30 dias** sem o recurso (o site para). O Supabase grátis
tem 5 GB de saída por mês. Um teste de 1000 pessoas gasta ~5% das requisições da Vercel; o teste de
cada publicação, ~0,1%; o alerta, ~1,5% por mês. Por isso o teste grande é à mão, e não a cada
mudança. Veja o consumo em Vercel → projeto → *Usage*.

No computador (o k6 fica em `%LOCALAPPDATA%\k6\k6.exe`; instale de
https://grafana.com/docs/k6/latest/set-up/install-k6/):

```bash
k6 run tests/carga/visitante.js                                  # 20 pessoas por 30 s
k6 run -e PERFIL=rampa -e MAX=300 tests/carga/visitante.js       # sobe até 300
k6 run -e FONTE=supabase tests/carga/visitante.js                # como era antes do cache
k6 run tests/carga/sonda.js                                      # a visita do alerta
```

Do computador, mais de ~300 pessoas medem a sua internet, não o site, e a proteção da Vercel pode
bloquear o seu IP por um tempo: para o teste grande, use o GitHub.

## Trocar o domínio

O endereço do site fica em um lugar só:

| Onde | De onde vem |
| --- | --- |
| Front (links de compartilhar, canonical, SEO) | `SITE_URL` em `js/config.js` |
| Funções de `api/` (links do e-mail "Liberar acesso", logo dos e-mails, User-Agent) | variável `SITE_URL`, lida em `api/_lib/site.mjs` (sem ela, o endereço da Vercel) |
| `index.html`, `sitemap.xml`, `robots.txt` (arquivos estáticos) | trocados pelo `scripts/publicar.sh` na hora de publicar |

**Domínio atual: `https://www.adbelemparquealvim.org.br`** (desde 09/11/2026; `adbelemparquealvim.org.br`
redireciona para o `www`). Ele já é o padrão no código (`js/config.js`, `api/_lib/site.mjs`,
`scripts/publicar.sh`, `index.html`, `sitemap.xml`, `robots.txt`): publicar não precisa de variável.
O endereço antigo, `assembleia-de-deus-pq-artur-alvim.vercel.app`, **redireciona de vez (308)**
para o domínio novo, mesmo caminho, com `?mudou=1` (o site mostra uma vez o aviso "o site mudou de
endereço", com o botão de reinstalar o app). É uma regra em `redirects` do `vercel.json`, por
host; ela **não pega `/api/`, `/_vercel/` nem `/sw.js`** (crons, funções e Analytics seguem respondendo no
endereço antigo; o `sw.js`, aberto lá, apaga as cópias guardadas e se desliga, e o app instalado
pelo endereço antigo passa a seguir o redirect) e não afeta as publicações de prévia. O Netlify antigo manda para o vercel.app,
que manda para cá (dois pulos, os dois permanentes). Assim o Google troca o endereço que mostra na
busca. As imagens passam pelo redutor da Vercel em qualquer domínio publicado lá (só no
`localhost` não).

**Busca do Google mostrando o endereço antigo:** o redirect resolve sozinho, mas leva de dias a
semanas. Para acelerar, no [Google Search Console](https://search.google.com/search-console):
(1) adicione a propriedade **Domínio** `adbelemparquealvim.org.br` (o Google dá um registro TXT
para criar no DNS do registro.br); (2) em *Sitemaps*, envie `https://www.adbelemparquealvim.org.br/sitemap.xml`;
(3) em *Inspeção de URL*, cole `https://www.adbelemparquealvim.org.br/` e clique em *Solicitar
indexação*. A ferramenta *Alteração de endereço* exige o endereço antigo verificado também (pela
meta tag `google-site-verification` no `index.html`); como o `vercel.app` é subdomínio da
Vercel, ela pode não aceitar, e não é obrigatória: o 308 já basta.

Passo a passo (troque `xxx.org.br` pelo domínio escolhido):

1. **Vercel → projeto → Settings → Domains → Add**: adicione `xxx.org.br` e `www.xxx.org.br`
   (deixe o `www` redirecionando para o domínio sem `www`). No painel do registro.br (DNS do
   domínio), crie **exatamente** os registros que a Vercel mostrar e espere a Vercel marcar o
   domínio como válido, com o certificado HTTPS emitido.
2. **Vercel → Settings → Environment Variables**: crie `SITE_URL` = `https://xxx.org.br`
   (ambiente *Production*). Assim as funções usam o domínio novo mesmo numa publicação feita sem a
   variável.
3. **Supabase → Authentication → URL Configuration**: em *Site URL* coloque `https://xxx.org.br`
   e em *Redirect URLs* adicione `https://xxx.org.br/**` (mantenha o endereço da Vercel enquanto
   ele estiver em uso). É o endereço dos e-mails que o próprio Supabase manda (convite de novo
   admin, redefinir senha): sem isso, esses links levam para o endereço antigo ou são recusados.
4. **Publique com a variável**: `SITE_URL=https://xxx.org.br bash scripts/publicar.sh`. Use a
   variável **em toda publicação** daqui em diante (ou deixe `export SITE_URL=https://xxx.org.br`
   no `~/.bashrc`); o script mostra no começo qual domínio está usando.
5. **Confira**: abra o site no domínio novo, veja o código-fonte (`canonical` e `og:url` com o
   domínio novo), abra `/robots.txt` e `/sitemap.xml`, entre no `/admin` e confira se o botão
   **Liberar acesso** do e-mail aponta para o domínio novo.
6. **Depois**: cadastre o domínio novo no Google Search Console e envie o `sitemap.xml`; se quiser
   e-mails saindo do domínio da igreja, verifique o domínio no Resend e ajuste `NOTIFY_FROM`; e
   troque o link no topo deste README.

## Créditos e licenças

- **Bíblia Livre** (BLIVRE) © 2018 Diego Santos, Mario Sérgio e Marco Teles — CC BY 4.0 Brasil
  (`data/bible/blivre/LICENCA.txt`).
- **Fraunces** e **Inter** — SIL Open Font License 1.1.
- **supabase-js** e **qrcode-generator** — MIT (`vendor/VERSIONS.txt`).
- **Harpa Cristã**: só o índice (número e título); letras e músicas são da CPAD e não estão aqui.
- O brasão, o nome e os textos da igreja pertencem à Assembleia de Deus Belém – Parque Artur Alvim.
