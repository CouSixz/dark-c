# Estúdio Corte

Trabalhe em português brasileiro. O fluxo ativo está em `painel/`. A Experiential Labs fornece apenas ideias, roteiro e direção de cena em JSON. O ElevenLabs fornece voz e marcas de tempo. O computador gera todos os quadros com Three.js e Remotion e monta o MP4 com FFmpeg. A duração inicial é de 61 segundos.

Respeite o perfil do canal e consulte o histórico antes de reservar uma ideia. Diferencie fatos e hipóteses, evite afirmações específicas sem fundamento e escreva para ser ouvido. Use a skill [.agents/skills/narracao-elevenlabs/SKILL.md](.agents/skills/narracao-elevenlabs/SKILL.md) para orientar o texto.

A descrição de cena usa o vocabulário de formas, cores, posições, escalas e movimentos aceito pelo motor. Valide os campos antes de sintetizar a voz. Para expressar uma nova linguagem visual, amplie o motor local e o contrato de cenas juntos. Guarde os resultados em `producoes/<canal>/<id>/`, preserve edições anteriores e reutilize gravação e roteiro ao retomar um trabalho.

As chaves pertencem ao cofre local da conta Windows. A tela de configuração deve retornar somente o estado da conexão e o catálogo. Testes de desenvolvimento usam provedores simulados e render local.
