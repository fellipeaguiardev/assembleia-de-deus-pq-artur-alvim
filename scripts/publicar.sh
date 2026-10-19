#!/usr/bin/env bash
# ============================================================
# Publica o site na Vercel (projeto assembleia-de-deus-pq-artur-alvim).
#
#   bash scripts/publicar.sh          → produção
#   bash scripts/publicar.sh teste    → endereço de teste (não mexe no site no ar)
#   bash scripts/publicar.sh montar   → só monta a pasta e mostra onde (não publica)
#
# Domínio: sem a variável SITE_URL, fica o endereço da Vercel. Para o domínio
# próprio:  SITE_URL=https://xxx.org.br bash scripts/publicar.sh
# O endereço é trocado em index.html, sitemap.xml, robots.txt e js/config.js
# da pasta montada (os arquivos do repositório não mudam) e o mesmo valor vai
# para as funções de api/ (process.env.SITE_URL).
#
# Monta uma pasta só com o que é público (páginas, css, js, imagens, dados)
# e as funções do servidor (api/). Carimba a versão (data e hora) em
# js/config.js, sw.js e version.json: é assim que o app instalado percebe
# que há versão nova e mostra "Atualizar".
# Precisa da Vercel CLI logada (npx vercel login) na conta da igreja.
# ============================================================
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
DIST="${DIST:-$(mktemp -d)}"
BUILD="$(date -u +%Y%m%d-%H%M)" # horário UTC

PADRAO="https://assembleia-de-deus-pq-artur-alvim.vercel.app"
SITE_URL="${SITE_URL:-}"
SITE_URL="${SITE_URL%/}"
if [ -n "$SITE_URL" ] && ! [[ "$SITE_URL" =~ ^https://[a-z0-9.-]+\.[a-z]{2,}$ ]]; then
  echo "SITE_URL inválida: \"$SITE_URL\". Use https://dominio (sem caminho nem barra no fim)."
  exit 1
fi

mkdir -p "$DIST"
cd "$SRC"
cp index.html manifest.webmanifest sw.js robots.txt sitemap.xml vercel.json "$DIST/"
cp -r css js vendor assets data api "$DIST/"
# A configuração local (outro projeto do Supabase, só para o computador) nunca vai para o ar.
rm -f "$DIST/js/config.local.json" "$DIST/js/config.local.example.json"
sed -i "s|VERSION: \"dev\"|VERSION: \"$BUILD\"|" "$DIST/js/config.js"
sed -i "s|const CACHE_VERSION = \"[^\"]*\";|const CACHE_VERSION = \"adbelem-$BUILD\";|" "$DIST/sw.js"
printf '{"v":"%s"}\n' "$BUILD" > "$DIST/version.json"
grep -q "VERSION: \"$BUILD\"" "$DIST/js/config.js" || { echo "Não consegui carimbar a versão em js/config.js"; exit 1; }

# Domínio próprio: troca o endereço da Vercel nos arquivos estáticos montados.
if [ -n "$SITE_URL" ] && [ "$SITE_URL" != "$PADRAO" ]; then
  ESTATICOS=("$DIST/index.html" "$DIST/sitemap.xml" "$DIST/robots.txt" "$DIST/js/config.js")
  sed -i "s|$PADRAO|$SITE_URL|g" "${ESTATICOS[@]}"
  if grep -l "$PADRAO" "${ESTATICOS[@]}"; then echo "Ainda sobrou o endereço antigo nos arquivos acima."; exit 1; fi
  echo "Domínio: $SITE_URL"
else
  echo "Domínio: $PADRAO (SITE_URL não definida)"
fi

if [ "${1:-}" = "montar" ]; then
  echo "Pasta montada (nada foi publicado): $DIST"
  exit 0
fi

cd "$DIST"
# Liga a pasta ao projeto da Vercel. O arquivo com os ids fica só nesta
# máquina (não vai para o GitHub); sem ele, a Vercel CLI liga pelo nome.
if [ -f "$SRC/scripts/vercel-projeto.json" ]; then
  mkdir -p .vercel && cp "$SRC/scripts/vercel-projeto.json" .vercel/project.json
else
  npx -y vercel@latest link --yes --project assembleia-de-deus-pq-artur-alvim
  cp .vercel/project.json "$SRC/scripts/vercel-projeto.json"
fi
ARGS=(deploy --yes)
[ "${1:-}" = "teste" ] || ARGS+=(--prod)
# As funções de api/ leem o mesmo endereço (sem a variável, valem as da Vercel).
if [ -n "$SITE_URL" ]; then ARGS+=(--env "SITE_URL=$SITE_URL"); fi
# Às vezes a Vercel falha por um instante: tenta de novo uma vez antes de desistir.
if ! npx -y vercel@latest "${ARGS[@]}"; then
  echo "A publicação falhou; tentando de novo em 10 s…"
  sleep 10
  npx -y vercel@latest "${ARGS[@]}"
fi
echo "Versão publicada: $BUILD"
