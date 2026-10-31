# Briefing: motions do logo {MARCA}

Você é um motion designer sênior criando UMA proposta de animação do logo **{MARCA}**
({DESCRICAO_DA_MARCA}). Pense em estúdio de motion de primeira
linha: direção clara, timing com intenção, easing autoral, nada de "fade in e pronto".

## Arquivos de referência (leia antes de começar)

- `../logo-data.js`: define `window.LOGO` com os vetores OFICIAIS (não redesenhe o logo):
  - `viewBox`: a caixa do logo, por exemplo `[0,0,2634,1147]`
  - `logo.<elemento>`: os caminhos do logo final, um por elemento ({ELEMENTOS}).
  - `letras.<palavra>[]`: cada letra em separado (`{char, d}`), já na posição final. Unidas, formam
    exatamente o caminho da palavra.
  - `letrasContorno.<palavra>[]`: a mesma letra com o contorno puro da fonte (um pouco mais fino),
    ideal para desenho em linha (stroke) antes do preenchimento.
  - `glifos.<simbolo>`: o glifo completo que originou o símbolo, na posição final (útil para morphs).
  - `cores`: {PALETA}.
- `../../index.html`: manual de marca (contexto visual: {GRAFISMOS_DO_SITE}).

## Regras da marca

{REGRAS_DE_COR}
- O quadro final de toda animação deve mostrar o logo EXATAMENTE como nos vetores oficiais
  (posições, proporções, cores). Durante a animação pode tudo; no fim, logo intacto.
- Só cores da paleta. Tipografia de apoio: {FONTES} (Google Fonts).
- Textos em português do Brasil, com acentuação correta. Não use travessão (—) em textos.

## Entrega (tudo dentro da SUA pasta, não toque em nada fora dela)

1. `index.html` autocontido: carrega `../logo-data.js` com `<script src="../logo-data.js">`.
   - Palco 16:9 responsivo que preenche a janela (`letterbox` se precisar). Fundo da marca.
   - Toca sozinho ao abrir. Controles discretos: Replay, Loop liga/desliga e, se fizer sentido,
     variantes (fundo escuro/claro, 16:9 / 9:16 / 1:1, versão curta/longa).
   - Com `?embed=1` na URL: sem controles, autoplay em loop (é assim que a galeria exibe).
   - `prefers-reduced-motion: reduce`: mostre direto o quadro final.
   - Bibliotecas: JavaScript puro, Web Animations API, Canvas/WebGL, ou GSAP 3.13.0 via cdnjs
     (`https://cdnjs.cloudflare.com/ajax/libs/gsap/3.13.0/gsap.min.js` e plugins da mesma pasta,
     como `DrawSVGPlugin.min.js`, `MorphSVGPlugin.min.js`, `CustomEase.min.js`). Nada de npm.
   - Performance: 60 fps em notebook comum; prefira transform/opacity e SVG bem estruturado.
2. `meta.js` com uma única chamada, assim (preencha com os seus dados):
   ```js
   window.registerMotion && window.registerMotion({
     id: "NOME-DA-PASTA",
     titulo: "Nome curto e autoral da proposta",
     conceito: "Uma ou duas frases sobre a ideia de direção.",
     usos: ["vídeo: abertura", "web: loading"],
     duracao: "4,5 s",
     tecnica: "SVG + GSAP DrawSVG, máscara, spring customizado",
     autor: "SEU-MODELO"
   });
   ```
   Crie o `meta.js` SÓ quando o `index.html` estiver pronto: a galeria passa a exibir sua
   proposta assim que o `meta.js` aparece.

## Proibido (a máquina é compartilhada)

- NÃO abra navegador, NÃO rode Playwright, Puppeteer, screenshots, servidores, builds, `npm`,
  `npx`, instalações ou testes. Só escreva os arquivos. A validação visual é feita depois por
  quem coordena, um de cada vez.
- NÃO edite arquivos fora da sua pasta.

## Qualidade esperada

- Uma ideia forte, ligada ao conceito da marca ({CONCEITO}).
- Coreografia em camadas: antecipação, ação principal, overshoot, assentamento. Stagger com
  intenção, nunca linear. Pense em como fica em vídeo E na web.
- Código limpo e comentado nos pontos de timing, fácil de ajustar duração.
