# Estrutura do manual e lista de peças

## Capítulos (ordem que funciona)

Cada capítulo é uma `<section id="...">` com número grande, rótulo, `<h2>` e um parágrafo de abertura. Subseções em grade de duas colunas: à esquerda o título e a regra em uma ou duas frases, à direita a demonstração.

| # | id | Conteúdo |
|---|---|---|
| — | capa | Logo grande, frase-conceito, versão e data, navegação, botões "PDF ↓" e "Pacote ZIP ↓" |
| — | sumario | Só no PDF: capítulos com número de página (preenchido por `pdf_manual.py`) |
| 01 | essencia | Manifesto curto e 3 ou 4 atributos da marca, tirados do que a empresa diz de si (site, redes) |
| 02 | logotipo | Versão principal e fundo claro; conceito (por que o símbolo é o que é); construção com guias e medidas reais (proporção, unidade x); área de proteção em x; redução mínima (px e mm) |
| 03 | versoes | 6 assinaturas por fundo (principal, claro, branca, sobre cor de acento, mono cor, mono grafite); símbolo isolado; ícone de app em 1024/64/32/16; 8 usos incorretos com X |
| 04 | cores | Cores com HEX (clique copia), RGB, CMYK e Pantone aproximado; proporção de uso em barra; tabela de contraste WCAG medida |
| 05 | tipografia | Fonte de marca e fonte de texto, pesos, caracteres com acentos, escala tipográfica com exemplos reais |
| 06 | elementos | Os grafismos que a marca já usa (no site, nas redes) transformados em regra: moldura, padrões, linhas, pontos |
| 07 | aplicacoes | Mockups de referência: cartão de visita, post, tela de app, assinatura de e-mail |
| 08 | grafismos | Biblioteca de fundos e padrões em SVG e PNG |
| 09 | reuniao | Fundos para Teams, Zoom e Meet; papéis de parede |
| 10 | digital | LinkedIn (capa pessoal e de empresa, posts), story, slides |
| 11 | assinaturas | 3 assinaturas de e-mail em HTML de tabela, com "Copiar HTML" e instruções |
| 12 | impressos | Folder trifold, papel timbrado (PDF, PNG e Word), crachá |
| 13 | voz | Como a marca escreve: pares certo/errado, inclusive como escrever o nome da marca |
| 14 | arquivos | Todos os downloads, os PNGs prontos, link para os motions |

Copie a paleta e as fontes do **site real** da marca (CSS), não invente. Use as cores existentes como base e derive tons de apoio (um escuro profundo, um claro "névoa") com nome próprio.

## Peças: tamanhos oficiais

| Peça | Tamanho | Observação |
|---|---|---|
| Fundo de reunião | 1920 × 1080 | Centro livre para a pessoa; logo no canto superior esquerdo. Avise do espelhamento da própria câmera |
| Papel de parede desktop | 2560 × 1440 | |
| Papel de parede celular | 1170 × 2532 | Elementos importantes fora do topo (relógio) e do rodapé |
| LinkedIn capa pessoal | 1584 × 396 | Canto inferior esquerdo fica sob a foto: deixe livre |
| LinkedIn capa de empresa | 1128 × 191 | Conteúdo à direita |
| Post quadrado | 1200 × 1200 (ou 1080 × 1080) | |
| Story / reels | 1080 × 1920 | Área segura: 250 px livres em cima e embaixo |
| Slide | 1920 × 1080 | Capa e conteúdo |
| Folder trifold A4 | 297 × 210 mm, 3 painéis de 99 mm | Lado externo (verso, contracapa, capa) e interno |
| Papel timbrado | A4 210 × 297 mm | Também em Word: `scripts/timbrado_word.js` |
| Crachá | 54 × 86 mm | |
| Assinatura de e-mail | ~440 px de largura | Tabela, estilos inline, Arial, imagens PNG em 2× |

## Como gerar as peças

Escreva cada peça como um HTML de tamanho fixo (um arquivo por peça, `html,body{width:Wpx;height:Hpx}`), com o logo embutido como SVG inline (os caminhos do `logo-data.js` ou do SVG) e fontes do Google Fonts. Renderize com Playwright no viewport exato:

- PNG: `page.screenshot()` com viewport = tamanho da peça.
- PDF de impresso: desenhe a 10 px por mm e gere o PDF com `scale = (largura_mm / 25.4 * 96) / largura_px` e `page_ranges='1'`. Sem a escala, o Chromium redistribui o layout na largura do papel em px de CSS e a peça sai quebrada (texto uma palavra por linha, faixas sumindo). Depois **compare o PDF renderizado com o PNG** (diferença média de pixel pequena).
- Grafismos: SVG puros, gerados por código (ondas por senos somados, padrões com `<pattern>`), mais o PNG.
- Brilho difuso: não use `feGaussianBlur` grande (vira faixas e cortes no screenshot); use `radialGradient` com paradas suaves.

Use dados de exemplo neutros ("Nome Sobrenome", "nome@marca.com.br", "+55 00 0000-0000") e diga ao usuário que são marcadores. Nunca invente nome de pessoa que pareça real.

## Pacote ZIP

Pastas numeradas e nomes padronizados `marca_<categoria>_<descricao>_<tamanho>.<ext>` (tamanho em px para digital e em mm para impresso):

```
00-LEIA-ME.txt
01-manual/              PDF + manual interativo
02-logo/svg|png/        03-simbolo/    04-icone-app/
05-cores/               CSS, JSON, TXT e SVG da paleta
06-tipografia/          fontes variáveis + instalar-no-computador/ (estáticas) + licenças OFL
07-grafismos/ … 14-impressos/   cada pasta com modelos-editaveis/ (o HTML de origem)
15-motion/              galeria de animações (se houver)
```

Escreva o empacotamento como script, porque ele roda várias vezes (cada vez que algo muda). Confira a integridade (`zipfile.testzip()`).
