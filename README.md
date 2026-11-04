<p align="center">
  <img src="assets/img/brasao.svg" alt="Brasão da Assembleia de Deus Belém – Parque Artur Alvim" width="120">
</p>

<h1 align="center">Assembleia de Deus Belém – Parque Artur Alvim</h1>

<p align="center">
  Site e app da igreja: cultos, Bíblia, Escola Bíblica, Harpa Cristã, biblioteca, vídeos, pedidos de oração<br>
  e um painel para a equipe cuidar de tudo sem precisar de programador.<br><br>
  <a href="https://assembleia-de-deus-pq-artur-alvim.vercel.app"><strong>assembleia-de-deus-pq-artur-alvim.vercel.app</strong></a>
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
| **Cultos e agenda** | Programação semanal com o **próximo culto calculado sozinho** (inclusive a Ceia do Senhor no 3º domingo do mês, quando a lição da EBD passa para o Culto de Ensino de terça), eventos, avisos e notícias. Qualquer culto ou evento vai para a agenda do celular (.ics / Google Agenda) com um toque. |
| **Bíblia Sagrada** | Bíblia completa no site (Bíblia Livre), busca por livro ou referência ("Jo 3.16", "Sl 23"), seleção de versículos para copiar, compartilhar ou gerar link, tamanho de letra e tema escuro, "continuar de onde parei" e leitura offline. O botão **Outras versões** abre a mesma passagem na ARC, ARA, NVI, NTLH, BKJ e outras. |
| **Palavra Diária** | Um versículo por dia para meditar, com os dias anteriores. |
| **Modo ouvir** | Lê em voz alta a Bíblia, a lição da EBD, a Palavra Diária e as notícias com a voz do próprio aparelho, com velocidade, destaque do trecho e continuação no próximo capítulo. |
| **Escola Bíblica Dominical** | Lição da semana de cada revista (Adultos, Jovens…), trimestres, texto áureo e leitura em classe com o texto bíblico, leitura diária para marcar, pontos principais, perguntas e link para a lição completa. |
| **Harpa Cristã** | Índice dos 640 hinos com busca por número ou nome, "Meus hinos" no aparelho e atalhos para ouvir e ver a letra. |
| **Biblioteca dos Jovens** | Acervo com busca e categorias, situação de cada livro (disponível, emprestado com data de volta, reservado), sinopse e pedido "Quero este livro" ou "Entrar na fila de espera". |
| **Vídeos e podcast** | Cultos e lives do YouTube atualizados sozinhos, busca e filtros, botão "Ao vivo" e player de podcast que continua tocando enquanto se navega. |
| **Comunidade** | Pedido de oração e contato (chega por e-mail à equipe), primeira visita (horários, endereço, como chegar), departamentos, história e liderança da igreja e ofertas por PIX com QR Code. |
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

- **HTML, CSS e JavaScript puro**, sem framework e sem etapa de build. O `package.json` é só dos
  testes (Playwright); o site publicado não usa npm.
- **Supabase**: banco Postgres com regras de acesso (RLS) por tabela, login do painel, armazenamento
  de imagens e uma função que busca os vídeos do YouTube.
- **Vercel**: hospedagem, funções do servidor (`api/`) e tarefa agendada diária.
- **Resend** para o e-mail dos pedidos de oração; **Web Speech API** para o modo ouvir;
  **service worker** para o app offline; abertura feita em CSS, SVG e canvas (sem vídeo).

## O que não está neste repositório

O `.gitignore` deixa de fora tudo o que é segredo ou dado da igreja:

- **Chaves e senhas**: ficam só nas variáveis de ambiente da Vercel (`RESEND_API_KEY`, `NOTIFY_TO`,
  `EBD_SYNC_TOKEN`, `CRON_SECRET`, `ADMIN_ACCESS_TOKEN`, `LIB_SHEET_ID`, `LIB_SYNC_TOKEN`,
  `LIB_TRIGGER_KEY`, `NEWS_SYNC_TOKEN`). A única chave no código é a **publicável** do Supabase, que é
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
                      ebd-sync-diario.mjs (agendada), admin-acesso.mjs e admin-aprovar.mjs
                      (liberação do painel por e-mail) e _lib/ (modelos de e-mail, leitor da EBD)
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
| `/palavra`, `/palavra/<data>` | O versículo do dia (mesma lista e mesma regra do navegador) |
| `/noticias/<slug>`, `/eventos`, `/ebd/…` | Supabase com a chave publicável, só leitura (RLS); notícia da sede aponta o `canonical` para o original |
| Demais rotas | `ROUTE_META` |

O `ROUTE_META`, a lista da Palavra Diária e a lista de páginas que existem (`ROUTE_BASES`) ficam em
`js/compartilhado.js`, lido igual pelo navegador e pelo servidor. **Endereço que o site não conhece**
volta com status **404** (com `noindex` e a mesma página "não encontrada"), assim como notícia que não
existe; o roteador do `js/site.js` usa a mesma lista, e o `scripts/verificar.mjs` confere que cada
página dela tem o seu `case` no roteador. Se a função falhar ou demorar mais de
2,5 s, ela devolve o `index.html` original (nunca uma página de erro). Cache curto na Vercel
(`s-maxage=300, stale-while-revalidate`). Ligada desde 04/11/2026 (`"destination":
"/api/pagina?caminho=/$1"` no `rewrites`). Para conferir o que o WhatsApp vê:
`curl -s -A "WhatsApp/2.23" https://assembleia-de-deus-pq-artur-alvim.vercel.app/biblia/joao/3/16 | grep -i "og:"`.
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

### Importação automática do sumário

Todo dia às 06:00 (Brasília) a função `api/ebd-sync-diario.mjs` (Vercel Cron) confere o sumário das
Lições Bíblicas em estudantesdabiblia.com.br (robots.txt permite) para as revistas marcadas no painel
(Adultos e/ou Jovens) e completa o trimestre atual — e o próximo, perto da virada: **tema,
comentarista, títulos, datas e referências bíblicas** (texto áureo, leitura em classe e leitura
diária) e o link de cada lição. Nunca copia o texto da lição e nunca sobrescreve o que a equipe
escreveu (só preenche campos vazios). O botão **Sincronizar agora** (Painel → EBD) faz o mesmo na hora
(`ebd-sincronizar.mjs`, só para admin). Por padrão as lições entram como rascunho; com **Publicar
sozinho** ligado, cada lição com texto áureo entra no ar na segunda-feira da semana dela.

O leitor da página de origem fica em `api/_lib/fonte.mjs` — se o layout de lá mudar, é ali que se
ajusta. Precisa do SQL `supabase/historico/20261010_ebd_sync.sql` e da variável `EBD_SYNC_TOKEN` no
Vercel (a chave do servidor; no banco fica só o hash dela). Educado com a origem: identifica-se no
User-Agent, uma requisição por vez, e só baixa a página de uma lição quando faltam dados dela.

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
  só para o leitor de tela); links "Saiba mais" com área de toque de ~44 px sem mudar o visual;
  títulos da página inicial sem pular nível (H1 → H2); o app não trava a orientação (tablets podem
  ficar na horizontal).
- Link "Pular para o conteúdo", janelas que prendem o foco e "reduzir movimento" respeitado.

## Privacidade (LGPD)

- O site não usa cookies de rastreamento nem de publicidade.
- **Estatísticas de visitas (Vercel Web Analytics)**, desligadas até você ligar (veja abaixo). Sem
  cookies e sem nada guardado no aparelho: contam a página (sem o `?…` e o `#…` do endereço), o
  site de origem, o país e o tipo de aparelho, sistema e navegador. Só rodam no endereço de
  `SITE_URL`: nunca no computador, nos endereços de teste da Vercel nem no painel (aberto direto
  em `/admin`, o script nem carrega; indo do site para o painel, a visita é descartada). Navegador
  com "não rastrear" (*Do Not Track* ou *Global Privacy Control*) não envia nada. A política em
  `/privacidade` ganha o item "Estatísticas de visitas" sozinha quando elas estão ligadas.
- YouTube, Spotify e Google Maps só carregam depois que o visitante permite
  (aviso de cookies; dá para mudar depois em “Preferências de cookies”, no rodapé).
- A política fica em `/privacidade`. Preencha em **Painel → Igreja & redes** o
  “E-mail para assuntos de privacidade”, que aparece na política.
- **Prazos de guarda automáticos:** `supabase/historico/20261014_lgpd_limpeza.sql` agenda no pg_cron uma
  limpeza diária (pedidos de livros encerrados há 6 meses; registros de entrada no painel com mais de 30 dias).
  Rode no *SQL Editor* do Supabase; sem ele a limpeza só acontece quando o painel é aberto.
- **Ligar as estatísticas** (uma vez):
  1. Vercel → projeto **assembleia-de-deus-pq-artur-alvim** → aba **Analytics** → **Enable** (o
     plano Hobby inclui uma cota mensal de eventos; o uso aparece em *Usage*, no painel da Vercel).
  2. A Vercel mostra o trecho para sites em HTML com o caminho do script, algo como
     `<script defer src="/abc123/script.js">`. Copie só o caminho (`/abc123/script.js`) para
     `ANALYTICS_SCRIPT` em `js/config.js` e publique (`bash scripts/publicar.sh`).
  3. Confira: `curl -sI https://assembleia-de-deus-pq-artur-alvim.vercel.app/abc123/script.js`
     precisa responder `content-type: application/javascript`. Se vier `text/html`, o rewrite do
     `vercel.json` está mandando o caminho para o `index.html`: o caminho precisa entrar na
     exceção do rewrite (`_vercel/` já está lá). O CSP já permite (`script-src 'self'` e
     `connect-src 'self'`: o script e o envio das visitas ficam no próprio endereço do site).
  4. Depois de alguns minutos, as visitas aparecem na aba Analytics. Para desligar: deixe
     `ANALYTICS_SCRIPT: ""` e publique (e, se quiser, **Disable** na mesma aba).
- **Pedidos de oração não ficam guardados no site:** `api/contato.mjs` só valida e manda o
  e-mail para a equipe (nada em banco ou em painel de formulários).

## Automações

| O quê | Como funciona |
| --- | --- |
| Lives e vídeos do YouTube | O Supabase lê o canal a cada 10 min e adiciona os vídeos novos |
| Próximo culto na home | Calculado sozinho a partir dos horários cadastrados |
| Avisos e eventos | Somem sozinhos depois da data final |
| Notícias e podcast agendados | Publique com data futura: aparecem sozinhos no dia |
| Pedidos de oração | Vão direto por e-mail para a equipe, com a identidade da igreja (nada fica guardado) |
| Lições da EBD | Vercel Cron todo dia às 06:00 (`api/ebd-sync-diario.mjs`) |
| Notícias da sede | Vercel Cron todo dia às 07:00 (`api/noticias-sede.mjs`): sugestões no painel, a equipe publica |
| Versão nova do app | O site confere `/version.json` ao voltar para o app e oferece “Atualizar” |

**E-mail dos pedidos:** a função `api/contato.mjs` recebe o formulário, barra robôs (campo-isca,
envio rápido demais, limite por endereço), monta o e-mail com o modelo `api/_lib/pedido-oracao.mjs`
(texto e versículo conforme o assunto, botão de WhatsApp) e envia pelo Resend (resend.com).
Variáveis na Vercel (*Settings → Environment Variables*): `RESEND_API_KEY`, `NOTIFY_TO`
(e-mails separados por vírgula), `EBD_SYNC_TOKEN`, `CRON_SECRET`, `ADMIN_ACCESS_TOKEN` e, opcionais,
`NOTIFY_FROM` e `ADMIN_APROVADORES`.
O brasão vai anexado ao e-mail (imagem `cid:`, arquivo
`assets/img/logo-email.png`) para aparecer mesmo quando o Gmail bloqueia imagens de fora. O assunto
leva data e hora para o Gmail não juntar pedidos diferentes na mesma conversa.
Sem domínio próprio verificado no Resend, ele só entrega para o e-mail da conta Resend;
para avisar outras pessoas, verifique um domínio da igreja no Resend e mude `NOTIFY_FROM`.

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

## Trocar o domínio

O endereço do site fica em um lugar só:

| Onde | De onde vem |
| --- | --- |
| Front (links de compartilhar, canonical, SEO) | `SITE_URL` em `js/config.js` |
| Funções de `api/` (links do e-mail "Liberar acesso", logo dos e-mails, User-Agent) | variável `SITE_URL`, lida em `api/_lib/site.mjs` (sem ela, o endereço da Vercel) |
| `index.html`, `sitemap.xml`, `robots.txt` (arquivos estáticos) | trocados pelo `scripts/publicar.sh` na hora de publicar |

Sem a variável `SITE_URL`, tudo continua com `assembleia-de-deus-pq-artur-alvim.vercel.app`. As
imagens passam pelo redutor da Vercel em qualquer domínio publicado lá (só no `localhost` não).

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
