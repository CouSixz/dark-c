# Corte · Estúdio de produção local

Abra **ABRIR ESTUDIO.cmd** no Windows. O inicializador usa Python 3 e Node.js com npm. Na primeira abertura, instala as dependências que faltarem. Mantenha a janela do estúdio aberta durante os renders.

1. Em **Configurações**, informe sua chave da Experiential Labs e clique em **Conectar Experiential Labs**. O estúdio lista os modelos disponíveis para essa chave. Escolha o modelo em **Produzir → IA de roteiro e direção**. [Catálogo da Experiential Labs](https://docs.experientiallabs.ai/reference/list-models)
2. Conecte o ElevenLabs com uma chave que permita consultar modelos e vozes e sintetizar fala. O painel carrega os modelos de síntese com português e as vozes da biblioteca da conta. A conexão faz consultas de catálogo. [Vozes do ElevenLabs](https://elevenlabs.io/docs/api-reference/voices/search)
3. Em **Canais**, cadastre nome, link, proposta, público, estilo, gancho e direção da voz. Para incluir vídeos feitos fora do estúdio, cole os assuntos já publicados, um por linha. O link identifica o canal. O histórico externo é alimentado pelos títulos informados.
4. Em **Produzir**, selecione canal, plataforma, IA de roteiro, modelo de voz e narrador. A duração inicial é 61 segundos. Use uma ideia própria ou clique em **Sugerir 5 ideias** e escolha uma. Cada novo pedido de sugestões consome uma chamada de texto.
5. Clique em **Gerar vídeo**. Uma chamada de texto escreve o roteiro e descreve os objetos e movimentos de cada cena. Uma chamada de voz grava o episódio inteiro. O motor local transforma essas descrições em animações Three.js, sincroniza as legendas às marcas de voz e renderiza o MP4 com Remotion e FFmpeg. O formato é vertical, 1080 × 1920, 30 fps. A voz é ajustada ao tempo escolhido.
6. Acompanhe em **Histórico** e clique em **Abrir MP4** na produção pronta. Após interrupção, **Retomar** aproveita os arquivos concluídos. Caso uma chamada paga tenha perdido a resposta, confira o consumo no provedor antes de autorizá-la novamente.

## Transferir para outro computador Windows

1. Feche o estúdio e compacte a pasta inteira `dark-c`, incluindo `.agents`, `painel/dados/estudio.sqlite3` e `producoes`. O banco guarda os canais e o histórico; as produções incluem gravações, vídeos e edições anteriores.
2. Na outra máquina, extraia o ZIP por completo antes de abrir o estúdio. Instale Python 3 e Node.js com npm, disponíveis no PATH.
3. Execute **ABRIR ESTUDIO.cmd** com internet. Ele instala as dependências Python e executa `npm ci` usando o `package-lock.json`. O Remotion baixa o navegador de renderização quando necessário; o FFmpeg faz parte das dependências do motor.
4. Em **Configurações**, conecte novamente Experiential Labs e ElevenLabs. As chaves salvas são cifradas para a conta Windows de origem e não funcionam na outra máquina.

As pastas `painel/motor/node_modules`, `.remotion`, `__pycache__` e `painel/dados/amostras_voz` são regeneráveis e foram retiradas desta entrega. Abrir o aplicativo ou renderizar pode recriá-las. A pasta `teste-mais-tarde` contém materiais de referência preservados. O backup de caches fica fora desta pasta e não precisa entrar no ZIP.

## Armazenamento e provedores

Cada episódio fica em `producoes/<canal>/<id>/`, com roteiro JSON, fala limpa, gravação original, marcações, descrição das cenas e vídeo final. Os canais, lotes de ideias e reservas de produção ficam em `painel/dados/estudio.sqlite3`. As credenciais são cifradas pelo Windows para a conta atual. Em outro computador, conecte novamente os provedores.

O estúdio filtra títulos iguais e semelhantes por canal e pede ao roteirista para verificar paráfrases antes da síntese de voz. A detecção de equivalência semântica é aproximada. Custos externos dependem do modelo de texto, do número de caracteres narrados e do plano de cada conta. Nenhum serviço remoto de geração de vídeo participa da produção.
