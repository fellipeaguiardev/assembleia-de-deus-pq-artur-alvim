# Fontes das imagens de versículo

Cópias em TTF, com peso fixo, das mesmas fontes do site (`assets/fonts/*.woff2`), só para
`api/imagem.mjs` (o gerador de imagem não lê WOFF2 nem fontes variáveis):

- `Fraunces-500.ttf`: Fraunces, peso 500, tamanho óptico 60 (o texto do versículo).
- `Inter-600.ttf` e `Inter-800.ttf`: Inter, pesos 600 e 800 (referência e rodapé).

As duas são licenciadas pela SIL Open Font License 1.1, que permite gerar e distribuir estas
versões derivadas. Para refazer: `fontTools.varLib.instancer` sobre os arquivos de `assets/fonts`.
