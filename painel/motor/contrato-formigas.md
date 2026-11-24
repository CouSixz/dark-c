# Direção local: formigas-v1

Extensão opcional da composição Corte. O fluxo de objetos geométricos existente continua disponível quando `visual` não está definido. O renderizador `render-formigas.mjs` lê o roteiro e as marcas existentes, valida o alinhamento e grava `cenas-direcao.json`, preservando `cenas.json`.

- `visual`: literal `formigas-v1`; nove tableaux SVG/React locais, na ordem do roteiro deste episódio.
- `totalFrames`: inteiro positivo, 2395 neste episódio; fonte da duração da composição.
- `shots`: nove cenas, com `from` e `frames` inteiros e contíguos. Cortes calculados pelo início de cada linha nas marcas, arredondados a 30 fps.
- `captionGroups`: grupos de até quatro palavras; `from` inclusivo e `to` exclusivo em quadros absolutos. Cada palavra tem `text`, `from`, `to` derivados dos tempos de caracteres originais. O destaque só aparece no intervalo da palavra.
- `audioFile`: arquivo local servido pelo publicDir da produção, `narracao.mp3`.

Vocabulário local: formiga segmentada de seis pernas (posição, escala, cor, direção, caminhada e folha), planta (posição, escala, cor), semente (posição, escala, rotação, cor), solo em perspectiva, ave, placas e dominós. Movimento determinístico em função do quadro: entrada com desaceleração, caminhada, balanço, queda, rotação e deslocamento. Sem recursos remotos ou sintetização de voz.

Execução na pasta do motor: `node render-formigas.mjs --preview` e `node render-formigas.mjs`. O MP4 usa 1080 × 1920, 30 fps, H.264, AAC e yuv420p. O cenário é identificado na tela como hipótese; o acúmulo e os efeitos ecológicos são ilustrados sem uma escala temporal factual.
