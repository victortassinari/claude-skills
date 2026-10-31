---
name: video-demo-narrado
description: Use when someone asks for a narrated demo video, product tour, tutorial video, promo or social-media cut of a web app (pedidos como "faz um vídeo do app", "grava uma demonstração", "vídeo narrado", "versão vertical", "coloca narração com IA", "vídeo para o manual"), including desktop and mobile screens, AI voice (ElevenLabs), captions and background music. Also when a Remotion render hangs on a recording, a Playwright mobile recording looks blurry, or narration drifts out of sync with the screen.
metadata:
  version: "1.0.0"
---

# Vídeo de demonstração narrado

## Visão geral

O vídeo é **código**: a tela é gravada por roteiro (Playwright), a voz sai da ElevenLabs a partir de um texto
versionado, e a montagem é um projeto Remotion. Tudo se refaz por partes: trocar uma fala não exige regravar a
tela, e regravar uma tela não paga a voz de novo.

**Princípio:** a fala manda no tempo. Cada cena dura a sua fala mais uma folga, e a gravação acelera ou desacelera
para caber. Por isso não existe "voz adiantada": a sincronia vem da composição, não do relógio da gravação.

O molde pronto está em `molde/` (nesta pasta da skill). Copie para `video/` no projeto e adapte.

## Quando usar

- Vídeo de demonstração, tutorial ou divulgação de um app web, com ou sem celular, horizontal e/ou vertical.
- Também para consertar: render do Remotion travado, celular borrado, narração fora de sincronia, voz picada.

## Caminho

1. **Roteiro em tabela, aprovado antes de gravar**: cena, o que aparece, a fala. Frases curtas, uma ideia por
   frase. Escreva números e siglas como se falam ("três mil", "PDF" vira "pê dê éfe" se a voz errar).
2. **Copie o molde** (`molde/` para `video/`), `npm install`, e exclua `video/` do tsconfig e do eslint da raiz
   (senão o tsc da raiz entra em `video/node_modules`).
3. **Identidade**: cores e fonte em `src/tema.ts` vêm do tema do app ou do DESIGN.md da marca; nome, frase e
   endereço em `PRODUTO` (`src/roteiro.ts`); logo em `public/` (PNG transparente: fotografe o logo do app com
   `locator.screenshot({ omitBackground: true })` em `deviceScaleFactor: 4`).
4. **Grave** com `capture/gravar.mjs` (exemplo comentado), um aparelho por vez, contra o build de produção ou com o
   servidor aquecido. Ele anota em `public/gravacoes/marcas.json` o segundo de cada momento **no arquivo**.
5. **Escreva as falas** em `src/falas.mjs` (uma por cena, mesmas chaves de `falas.d.mts`) e **narre**:
   `npm run narrar` (cache por hash; `previous_text`/`next_text` ligam a entonação entre cenas). Narre antes do
   passo 6: `roteiro.ts` importa `public/narracao/indice.json`, que só existe depois disso.
6. **Monte o roteiro** em `src/roteiro.ts`: cada cena aponta a gravação e os trechos. O `de` de um trecho é a
   marca da ação que a fala descreve; o `ate`, a marca seguinte. Se a fala for mais longa que o trecho, a
   gravação desacelera; se for bem mais curta (passa de 2,5x), corte o trecho ou junte dois trechos curtos.
7. **Confira por quadros antes do render**: `npm run quadros` (9 quadros por formato, em segundos) e monte uma
   folha de contato. Olhe de verdade: legenda tapando conteúdo, cena sem a ação que a fala descreve, tela vazia.
8. **Render**: `npm run render` (horizontal e vertical, um depois do outro).
9. **Finalize o áudio** de cada versão: `node scripts/finalizar.mjs out/video.mp4 --velocidade 1.25
   [--trilha musica.mp3]` e o mesmo para `out/video-vertical.mp4` (voz em -16 LUFS, trilha em -32 LUFS com
   ducking, versão 1,25x, medição no fim). Para redes sociais, a vertical sem aceleração costuma ler melhor.
   As legendas saem gravadas na imagem; se pedirem arquivo de legenda (SRT/VTT), gere a partir de
   `frasesDaFala` e `inicioDaCena`.
10. **Entregue**: extraia quadros do mp4 final (`ffmpeg -ss <t> -frames:v 1`), confira as duas versões e abra no
    navegador de quem pediu.

## Referência rápida

| Tarefa | Comando ou valor |
|---|---|
| Folha de contato | `ffmpeg -i video.mp4 -vf "fps=1/5,scale=480:-1,tile=4x5" -frames:v 1 folha.png` |
| Quadros escolhidos | `QUADROS='[10,400,-30]' node scripts/quadros.mjs` (negativo conta do fim) |
| Volume integrado | `ffmpeg -i v.mp4 -af ebur128=framelog=quiet -f null -` (alvo -16 LUFS, pico até -1,5) |
| Vozes pt-BR testadas | Christine `TOXnXBKJSHqTwwqoWW0D`, Paulo `Qrdut83w0Cr152Yb4Xn3`, Fernanda `7iqXtOF3wl3pomwXFY7G` |
| Música livre | Kevin MacLeod (incompetech.com, CC BY 4.0, crédito no vídeo); "Wallpaper" e "Dreamer" servem para produto |
| Custo de voz | 1 crédito por caractere (meio nos modelos Turbo); `narrar` imprime o total de caracteres |

## Armadilhas

| Sintoma | Causa | Correção |
|---|---|---|
| Render do Remotion parado, CPU baixa, `delayRender` estourando | `OffthreadVideo` lendo o webm do Playwright, que não tem índice de busca | Converter para mp4 com quadro-chave a cada 1 s (`-g 30`); o gravador do molde já faz |
| Render trava numa cena específica | A cena pede um quadro depois do fim do arquivo | Nunca esticar o trecho além do `ate`; o `planejar` do molde desacelera em vez disso; `tpad` estende o último quadro |
| Celular borrado no vídeo | `recordVideo` grava em pixels CSS (390 px) mesmo com `deviceScaleFactor` | Screencast do Chrome por CDP na densidade do aparelho (gravador do molde) |
| Gravação do celular mais curta que o roteiro | O screencast só manda quadro quando a tela muda | Cada quadro dura até o próximo e o último é estendido (`tpad`) |
| Voz adiantada em relação à tela | Fala posicionada pelo relógio do roteiro; a imagem atrasa quando a máquina está carregada (até 3,6 s em 80 s) | A fala define a duração da cena (molde). Narrando sobre gravação contínua sem Remotion: marcador de cor por fala lido do próprio vídeo, para sincronizar cada fala com o quadro em que ela começa |
| Narração robótica, picada | Cada frase gerada isolada, sem fade, `speed` acima de 1 somado à versão acelerada | `previous_text`/`next_text`, `speed` 1.0 e acelerar só na finalização |
| Trilha "bombeando" entre frases | Ducking rápido demais | `sidechaincompress` com ataque 150 ms e retorno 1,2 s; trilha ~16 dB abaixo da voz |
| Áudio baixo demais | Narração sem normalizar (média perto de -30 dB) | `loudnorm=I=-16:TP=-1.5`; depois de `loudnorm`, `aresample=48000` (ele sobe para 192 kHz) |
| Legenda começa com minúscula ou corta no lugar errado | Corte em `!` ou `:` dentro da frase | Cortar só onde a frase seguinte começa com maiúscula (`frasesDaFala` do molde) |
| Animação diferente a cada render | Animação por relógio (`requestAnimationFrame`, Web Animations) | Calcular tudo do `useCurrentFrame()`; para portar uma animação do app, chamar a função de desenho com `t = frame / fps * 1000` |
| Tela em branco ou indicador do Next no vídeo | Primeira compilação do modo de desenvolvimento | Aquecer a página antes da marca de início ou gravar no build de produção; esconder `nextjs-portal` |
| Página recarregando sem parar durante a gravação | Log do servidor de desenvolvimento escrito dentro do projeto (o watcher recompila a cada linha) ou servidores `tsx watch` órfãos | Log fora do projeto; ao parar, matar o `tsx watch` pai, não só o Node da porta |
| Render abre Chrome e falha ao conectar | Chrome headless órfão de um render interrompido | Encerrar os `chrome-headless-shell` antes; reaproveitar um navegador (`openBrowser`) nos quadros |

## Adaptar ao projeto

O que muda por projeto fica em quatro lugares: `src/tema.ts` (cores e fonte), `PRODUTO` e `CENAS` em
`src/roteiro.ts`, `src/falas.mjs` e as ações de `capture/gravar.mjs` (login, dados de teste com e-mail `+`,
seletores, `esconder` e `trocas`). Guarde o roteiro de gravação e as falas no repositório; as gravações e o `out/`
ficam fora do git (são grandes e se refazem).
