# Contrato visual mosquitos-v1

Composição local SVG/React em mosquitos.jsx, selecionada por visual="mosquitos-v1" em filme.jsx. Não altera o contrato genérico de objetos nem o episódio formigas-v1.

Entrada: shots (9 cenas, from e frames inteiros a 30 fps), captionGroups (from, to, words com text/from/to), totalFrames=2136, seconds=71.2, audioFile="audio/mixagem.wav". Canvas: 1080x1920. Paleta fixa: #0b1e3a, #ffc93c, #2ee6c5, #ff3da6.

Vocabulário especializado por índice: mosquito e relógio; quarto com janela e cama; hospital e interrupção de picadas; prateleiras e frascos; corredor com leitos e médico; mosquito, peixe e sapo; laboratório com scanner; relógio de meia-noite; placa de laboratório com mosquitos. Movimentos determinísticos: flutuação senoidal, batimento das asas, rotação orbital, varredura, entrada com escala/rotação e realce de palavra. Nenhum gerador de imagem ou provedor remoto é usado no render.

Validação no render-mosquitos.mjs: correspondência integral entre fala e caracteres, marcas monotônicas, durações positivas, nove cenas contíguas, legendas com até quatro palavras. Inícios de cena derivados das quebras de linha nas marcas; 2136 quadros totais. Última letra falada termina em 70.96s; marca final de pontuação vai até 71.28s. O corte pedido em 71.20s preserva a última palavra.

Reprodução: node painel/motor/render-mosquitos.mjs --preview; node painel/motor/render-mosquitos.mjs. Render H.264 CRF18, AAC, yuv420p. Um MP4 preexistente é copiado antes da substituição. Fontes, áudio, roteiro e marcas originais são preservados.

Notas editoriais visíveis distinguem hipótese de fato sem alterar a tomada oficial. A queda imediata de casos, os leitos vazios e a ausência de comida não decorrem automaticamente de 24h sem picadas. Referências: https://www.who.int/news-room/fact-sheets/detail/dengue-and-severe-dengue e https://radis.ensp.fiocruz.br/reportagem/ciencia/o-segredo-da-wolbachia/ . Wolbachia não é modificação genética.

Sonoplastia: som-mosquitos.py gera efeitos e música originais localmente, aplica redução durante a fala, mixa com a gravação original e normaliza o áudio. Preserva o vídeo anterior em edicoes/, copia a imagem sem recodificar e verifica pico verdadeiro após AAC. Plano e medições em audio/. O renderizador exige a mixagem para evitar regressão para voz isolada. Para atualizar um vídeo existente: python painel/motor/som-mosquitos.py.
