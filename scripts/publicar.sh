#!/usr/bin/env bash
# ============================================================
# Publica o site na Vercel (projeto assembleia-de-deus-pq-artur-alvim).
#
#   bash scripts/publicar.sh          → produção
#   bash scripts/publicar.sh teste    → endereço de teste (não mexe no site no ar)
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

mkdir -p "$DIST"
cd "$SRC"
cp index.html manifest.webmanifest sw.js robots.txt sitemap.xml vercel.json "$DIST/"
cp -r css js vendor assets data api "$DIST/"
sed -i "s|VERSION: \"dev\"|VERSION: \"$BUILD\"|" "$DIST/js/config.js"
sed -i "s|const CACHE_VERSION = \"[^\"]*\";|const CACHE_VERSION = \"adbelem-$BUILD\";|" "$DIST/sw.js"
printf '{"v":"%s"}\n' "$BUILD" > "$DIST/version.json"
grep -q "VERSION: \"$BUILD\"" "$DIST/js/config.js" || { echo "Não consegui carimbar a versão em js/config.js"; exit 1; }

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
# Às vezes a Vercel falha por um instante: tenta de novo uma vez antes de desistir.
if ! npx -y vercel@latest "${ARGS[@]}"; then
  echo "A publicação falhou; tentando de novo em 10 s…"
  sleep 10
  npx -y vercel@latest "${ARGS[@]}"
fi
echo "Versão publicada: $BUILD"
