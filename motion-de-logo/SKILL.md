---
name: motion-de-logo
description: "Cria várias propostas profissionais de animação (motion) de um logo, para vídeo, web, loading, splash de app, teaser, transições e lower thirds, despachando direções diferentes para vários modelos e CLIs (subagentes Claude, Codex, Gemini via agy, Grok, opencode) em paralelo, com uma galeria HTML que se atualiza sozinha, validação por quadros e revisão de qualidade. Use sempre que alguém pedir 'animação do logo', 'motion do logo', 'logo animado', 'vinheta', 'abertura de vídeo com o logo', 'loading com o logo', 'intro animada', 'logo reveal', 'várias opções de animação', ou quiser comparar propostas de motion de modelos diferentes."
metadata:
  version: "1.1.0"
---

# Motion de logo

## Visão geral

Pedir "anima o logo" a um modelo dá um fade. Animação boa vem de **ideias que só servem para aquele logo** (nascidas da leitura das formas, do estilo e do contexto da marca, nunca de uma lista pronta), de **vetores oficiais separados por letra** (para animar cada peça e terminar no logo exato) e de **revisão de verdade** (olhar os quadros, não só ver se carrega). Esta skill monta essa linha de produção: briefing, dados, galeria, despacho para vários modelos ao mesmo tempo e validação.

## Processo

### 1. Dados do logo

Você precisa de `motion/logo-data.js` definindo `window.LOGO` com os caminhos oficiais, cada letra separada, o contorno puro de cada letra e cada peça que não é letra (símbolo, acento, corte) também em separado. A skill `vetorizar-logo` gera esse arquivo (`montar`). Se o logo já existe em SVG, monte o arquivo a partir dele, separando as letras. Mantenha o formato estável enquanto houver agentes trabalhando: há propostas que leem os comandos do caminho (M, L, Q) diretamente, e trocar o formato no meio quebra essas propostas.

### 2. Leitura do logo

Antes de pensar em animação, olhe o logo renderizado e leia o que houver sobre a marca (manual, site, briefing da pessoa). Escreva `motion/LEITURA.md` com estas cinco partes:

1. **Anatomia:** cada peça do logo, como ela é construída (cheia, em linha, letra) e o que pode se separar.
2. **O que só este logo tem:** a geometria particular, como um recorte, um raio que se repete, um contraste de peso ou a relação entre as peças.
3. **Contexto:** o que a marca faz, para quem fala e qual é o tom dela.
4. **Fora de tom:** os movimentos que contrariariam a marca, como elástico numa marca sóbria ou rigidez numa marca lúdica.
5. **Pontos de partida:** uma observação concreta por proposta livre, tirada das partes 2 e 3, sem coreografia. Exemplo: "o ícone repete o mesmo raio em duas escalas". Cada proposta recebe um ponto diferente, para as ideias não convergirem.

### 3. Briefing e galeria

- Copie `assets/BRIEF.md` para `motion/BRIEF.md` e preencha os `{MARCADORES}` (marca, conceito, elementos, paleta, regras de cor, fontes, grafismos do site). O briefing fixa o contrato: `index.html` autocontido, `?embed=1` para a galeria, `prefers-reduced-motion`, `meta.js` criado por último e a proibição de abrir navegador ou rodar comandos. Acrescente a ele a seção de proibições de `references/repertorio.md` que vale para as peças pedidas; a tabela de técnicas fica para depois.
- Copie `assets/galeria/index.html` e `assets/galeria/slots.js` para `motion/`. Ajuste as cores do `:root`, ponha o SVG do logo como `motion/logo.svg` e liste em `slots.js` cada pasta esperada, com o autor. A galeria procura `meta.js` novos a cada 8 s, sem servidor (funciona aberta como arquivo), e mostra "em produção" até cada proposta ficar pronta.
- Abra a galeria no navegador do usuário logo no início: ele quer ver as propostas entrando.

### 4. Direções e despacho

Monte a rodada assim, nesta ordem:

1. **Peças de uso pedidas pela pessoa** (loading, tarjas, splash, transições) viram propostas **dirigidas** e entram no total pedido, salvo se ela disser que são à parte. A direção diz o uso e as restrições; a coreografia fica com o modelo.
2. **Todo o restante é livre.** O modelo recebe um ponto de partida próprio, que pode trocar por uma ideia melhor, e decide a ideia, o estilo e a duração. Livres são pelo menos dois terços da rodada, salvo quando a própria pessoa pediu só peças de uso.
3. **Uma ideia sua, se a leitura pedir:** escreva-a como dirigida a partir da leitura. Ela entra no total.

Todas as propostas, dirigidas ou livres, recebem `LEITURA.md`. A tabela de técnicas de `references/repertorio.md` é consulta: abra depois que a ideia existir, para executá-la melhor.

- Cada estúdio (um modelo) recebe pelo menos uma proposta livre.
- Para rodadas extras, liste no prompt tudo o que já existe na galeria (títulos e conceitos dos `meta.js`) para o modelo não repetir.
- Comandos, flags e armadilhas de cada CLI: `references/despacho.md`. Pergunte ao usuário quais CLIs e planos ele tem antes de presumir (`which`, `--help`, listas de modelos). Se um CLI não estiver instalado, diga e ofereça o mesmo modelo por outro caminho.
- Agentes só escrevem arquivos. Validação com navegador é sua, uma de cada vez (é trabalho pesado para a máquina).

### 5. Validação em duas camadas

**Funciona?** Assim que um `meta.js` aparecer: `python scripts/quadros.py motion/ quadros/ <id>` captura 5 quadros e os erros de console. Olhe a folha de quadros: o quadro final é o logo oficial inteiro, dentro do quadro e com respiro? Há peças aparecendo antes da hora? Corrija você mesmo bugs pequenos (enquadramento, máscara) ou devolva ao mesmo agente com a lista exata.

**É bom?** Esta é a camada que faltou na primeira vez, e o usuário apontou propostas "horríveis" que tinham passado por "funciona". Com `--grande` (8 quadros em 1600 × 900), avalie cada proposta como diretor de arte: a ideia é forte e ligada à marca? Trocando este logo por outro, ela continuaria funcionando igual? Se sim, é genérica. A coreografia tem antecipação, ação e assentamento? A tipografia e o acabamento estão no nível de um estúdio? Há algo amador (formas deformadas, desenho tosco, elementos sobre o texto, linhas fracas ou espinhentas)? Dê nota e um comentário curto a cada uma e proponha refazer as fracas, com briefing que liste o que estava errado (veja as proibições em `references/repertorio.md`).

### 6. Entrega

- Galeria final com todas as propostas, os autores corretos e nenhum card "em produção" sobrando.
- Se houver manual de marca, a galeria entra no pacote ZIP (`15-motion/`) e na publicação (skill `manual-de-marca`).
- Diga ao usuário quais propostas você corrigiu, quais refez e por quê, e quais modelos falharam e por quê (cota, permissão, ferramenta), sem culpar o modelo quando a falha foi da chamada.

## Comunicação durante o trabalho

O trabalho é longo e paralelo. A cada entrega validada, avise em duas ou três linhas o que entrou e como está a contagem (por exemplo, "24 de 36 prontas"). Quando um estúdio parar sem entregar, investigue o log antes de relançar e conte ao usuário a causa real.
