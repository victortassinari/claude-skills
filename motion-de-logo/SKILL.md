---
name: motion-de-logo
description: "Cria várias propostas profissionais de animação (motion) de um logo, para vídeo, web, loading, splash de app, teaser, transições e lower thirds, despachando direções diferentes para vários modelos e CLIs (subagentes Claude, Codex, Gemini via agy, Grok, opencode) em paralelo, com uma galeria HTML que se atualiza sozinha, validação por quadros e revisão de qualidade. Use sempre que alguém pedir 'animação do logo', 'motion do logo', 'logo animado', 'vinheta', 'abertura de vídeo com o logo', 'loading com o logo', 'intro animada', 'logo reveal', 'várias opções de animação', ou quiser comparar propostas de motion de modelos diferentes."
metadata:
  version: "1.0.0"
---

# Motion de logo

## Visão geral

Pedir "anima o logo" a um modelo dá um fade. Animação boa vem de **direções claras** (uma ideia ligada ao conceito da marca, com coreografia descrita), de **vetores oficiais separados por letra** (para animar cada peça e terminar no logo exato) e de **revisão de verdade** (olhar os quadros, não só ver se carrega). Esta skill monta essa linha de produção: briefing, dados, galeria, despacho para vários modelos ao mesmo tempo e validação.

## Processo

### 1. Dados do logo

Você precisa de `motion/logo-data.js` definindo `window.LOGO` com os caminhos oficiais, cada letra separada e o contorno puro de cada letra. A skill `vetorizar-logo` gera esse arquivo (`montar`). Se o logo já existe em SVG, monte o arquivo a partir dele, separando as letras. Mantenha o formato estável enquanto houver agentes trabalhando: há propostas que leem os comandos do caminho (M, L, Q) diretamente, e trocar o formato no meio quebra essas propostas.

### 2. Briefing e galeria

- Copie `assets/BRIEF.md` para `motion/BRIEF.md` e preencha os `{MARCADORES}` (marca, conceito, elementos, paleta, regras de cor, fontes, grafismos do site). O briefing fixa o contrato: `index.html` autocontido, `?embed=1` para a galeria, `prefers-reduced-motion`, `meta.js` criado por último e a proibição de abrir navegador ou rodar comandos.
- Copie `assets/galeria/index.html` e `assets/galeria/slots.js` para `motion/`. Ajuste as cores do `:root`, ponha o SVG do logo como `motion/logo.svg` e liste em `slots.js` cada pasta esperada, com o autor. A galeria procura `meta.js` novos a cada 8 s, sem servidor (funciona aberta como arquivo), e mostra "em produção" até cada proposta ficar pronta.
- Abra a galeria no navegador do usuário logo no início: ele quer ver as propostas entrando.

### 3. Direções e despacho

- Escolha direções em `references/direcoes.md`, adaptadas à marca. Cada estúdio (um modelo) recebe **duas pastas: uma dirigida e uma livre**. A livre é obrigatória; o usuário vai pedir, e várias das melhores propostas vêm dela.
- Para rodadas extras de tema livre, liste no prompt tudo o que já existe na galeria (títulos e conceitos dos `meta.js`) para o modelo não repetir.
- Comandos, flags e armadilhas de cada CLI: `references/despacho.md`. Pergunte ao usuário quais CLIs e planos ele tem antes de presumir (`which`, `--help`, listas de modelos). Se um CLI não estiver instalado, diga e ofereça o mesmo modelo por outro caminho.
- Agentes só escrevem arquivos. Validação com navegador é sua, uma de cada vez (é trabalho pesado para a máquina).

### 4. Validação em duas camadas

**Funciona?** Assim que um `meta.js` aparecer: `python scripts/quadros.py motion/ quadros/ <id>` captura 5 quadros e os erros de console. Olhe a folha de quadros: o quadro final é o logo oficial inteiro, dentro do quadro e com respiro? Há peças aparecendo antes da hora? Corrija você mesmo bugs pequenos (enquadramento, máscara) ou devolva ao mesmo agente com a lista exata.

**É bom?** Esta é a camada que faltou na primeira vez, e o usuário apontou propostas "horríveis" que tinham passado por "funciona". Com `--grande` (8 quadros em 1600 × 900), avalie cada proposta como diretor de arte: a ideia é forte e ligada à marca? A coreografia tem antecipação, ação e assentamento? A tipografia e o acabamento estão no nível de um estúdio? Há algo amador (formas deformadas, desenho tosco, elementos sobre o texto, linhas fracas ou espinhentas)? Dê nota e um comentário curto a cada uma e proponha refazer as fracas, com briefing que liste o que estava errado (veja as proibições em `references/direcoes.md`).

### 5. Entrega

- Galeria final com todas as propostas, os autores corretos e nenhum card "em produção" sobrando.
- Se houver manual de marca, a galeria entra no pacote ZIP (`15-motion/`) e na publicação (skill `manual-de-marca`).
- Diga ao usuário quais propostas você corrigiu, quais refez e por quê, e quais modelos falharam e por quê (cota, permissão, ferramenta), sem culpar o modelo quando a falha foi da chamada.

## Comunicação durante o trabalho

O trabalho é longo e paralelo. A cada entrega validada, avise em duas ou três linhas o que entrou e como está a contagem (por exemplo, "24 de 36 prontas"). Quando um estúdio parar sem entregar, investigue o log antes de relançar e conte ao usuário a causa real.
