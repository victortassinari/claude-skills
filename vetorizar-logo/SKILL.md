---
name: vetorizar-logo
description: "Reconstrói em SVG vetorial limpo e fiel um logo que só existe em PNG/JPG, fazendo engenharia reversa da fonte e das formas (encaixe de glifos reais, espessura do traço, círculos), com verificação pixel a pixel e curvas cúbicas lisas. Use sempre que alguém pedir 'logo em SVG', 'vetorizar o logo', 'redesenhar o logo em vetor', 'logo em alta', 'só tenho o PNG do logo', 'preciso do logo para impressão', ou quando um projeto de marca, manual ou animação precisar do logo em vetor e só houver imagem rasterizada. Também quando um SVG de logo aparece serrilhado ou facetado ao ampliar."
metadata:
  version: "1.0.0"
---

# Vetorizar logo

## Visão geral

Traçar o contorno de um PNG (potrace, Illustrator "traçado de imagem") gera bordas tortas e centenas de nós. Logos tipográficos são feitos com uma fonte: se você descobre a fonte e encaixa os **glifos reais** sobre o PNG, o resultado é o desenho original, com curvas perfeitas. Elementos que não são letras costumam ser formas simples (círculos) ou outros glifos da mesma fonte (um balão que é um "a" preenchido, um ícone que é um "o").

O script `scripts/vetorizar.py` faz o trabalho pesado:

1. `inspecionar`: cores dominantes e componentes conectados do PNG (para montar o config).
2. `ajustar`: otimiza escala, linha de base, posição de cada letra e **espessura do traço** contra a cobertura do PNG.
3. `montar`: gera os SVGs com curvas cúbicas, variantes de cor e `logo-data.js` (cada letra separada, para animar).
4. `verificar`: renderiza o SVG no tamanho do PNG, mede IoU e erro e gera `diff.png` e `ampliado-6x.png`.

Dependências: `pip install numpy scipy pillow matplotlib fonttools skia-python skia-pathops playwright` e `python -m playwright install chromium`.

## Processo

### 1. Pegue a melhor fonte de pixels

Baixe o maior PNG disponível (site, redes, favicon de alta). Procure também a versão em outra cor (fundo claro e fundo escuro): mesma geometria, cores diferentes, e uma confirma a outra. Rode `python scripts/vetorizar.py inspecionar logo.png`.

### 2. Descubra a fonte

Ordem que funciona:
- **O próprio site da marca:** baixe o HTML e o CSS e procure `font-family` e links do Google Fonts. Muitas vezes o arquivo do logo tem o nome da fonte (ex.: `novo-logo-fonte-comfortaa.png`).
- **Formas características:** compare letras distintivas (a, g, e, t) com candidatas do Google Fonts.
- Baixe o TTF (variável serve; o script instancia o peso): `https://github.com/google/fonts/raw/main/ofl/<familia>/<Arquivo>.ttf`.
- Se nada bater, teste versões antigas da fonte (o histórico do repositório google/fonts tem as estáticas antigas). Logos feitos anos atrás às vezes usam uma versão anterior.

Se o logo não for tipográfico (símbolo desenhado à mão, mascote), esta skill não serve: diga isso ao usuário e proponha redesenho manual a partir de formas geométricas.

### 3. Escreva o config.json

```json
{
  "png": "logo.png",
  "fonte": "Comfortaa.ttf",
  "peso": 700,
  "nome_marca": "marca",
  "saida": "saida",
  "paleta": {"laranja": "#F73C07", "roxo": "#6A009E"},
  "elementos": [
    {"nome": "simbolo", "tipo": "glifo", "char": "a", "cor": "#FFFFFF", "regiao": [190, 0, 264, 66], "ajustar_traco": false, "engrossar": false},
    {"nome": "palavra1", "tipo": "texto", "texto": "be", "cor": "#FFFFFF", "regiao": [0, 60, 80, 113]},
    {"nome": "palavra2", "tipo": "texto", "texto": "active", "cor": "#F73C07", "regiao": [70, 60, 248, 113]},
    {"nome": "ponto", "tipo": "circulo", "cor": "#F73C07", "regiao": [248, 60, 264, 86]}
  ],
  "variantes": [
    {"nome": "fundo-claro", "cores": {"simbolo": "#6A009E", "palavra1": "#6A009E"}},
    {"nome": "mono-branco", "cor": "#FFFFFF"},
    {"nome": "simbolo-roxo", "cores": {"simbolo": "#6A009E"}, "elementos": ["simbolo"]}
  ]
}
```

- `tipo`: `texto` (uma palavra, cada letra posicionada separadamente, porque logos costumam ter kerning ajustado à mão), `glifo` (um caractere usado como forma; `so_externo: true`, o padrão, pega só a silhueta, sem o miolo) ou `circulo`.
- `regiao` `[x0, y0, x1, y1]` é obrigatória quando duas peças têm a mesma cor; use as caixas do `inspecionar`.
- `ajustar_traco: true` (padrão) estima se o logo foi feito com traço mais grosso que a fonte. É comum: o designer aplica contorno para "encorpar". O valor em px aparece no ajuste.
- `peso`: para fontes variáveis. Se o melhor encaixe pedir muito traço extra, teste um peso maior.

### 4. Ajuste, monte e verifique

```bash
python scripts/vetorizar.py ajustar config.json     # 1 a 3 min em PNG pequeno
python scripts/vetorizar.py montar config.json
python scripts/vetorizar.py verificar config.json
```

Leia os três resultados da verificação **olhando as imagens**, não só os números:
- **IoU** acima de 0,92 em PNG de até 300 px já é encaixe fiel; o resto é antisserrilhado da imagem de origem.
- **diff.png**: vermelho é o que falta no SVG, verde é o que sobra. Uma borda fina e uniforme é normal. Uma **mancha** vermelha ou verde é peça errada (letra trocada, glifo mutilado, região mal recortada).
- **ampliado-6x.png**: as bordas têm que ser lisas. Facetas (polígonos) indicam problema no engrossamento ou conversão.

### 5. Mostre ao usuário lado a lado

Monte uma página HTML local com: PNG original ampliado ao lado do SVG; **o nome da marca digitado com a fonte real** ao lado do SVG, em tamanho grande (o usuário vai querer comparar a suavidade das bordas); e as variantes sobre os fundos certos. Abra no navegador do usuário.

## Armadilhas (todas aconteceram)

| Sintoma | Causa | Correção |
|---|---|---|
| Glifo-símbolo sai cortado (falta a haste do "a") | Fonte variável desenha a letra com contornos sobrepostos; "maior contorno" pega só a bacia | O script já remove sobreposições (`removeOverlaps`) depois de instanciar |
| Bordas facetadas, pingo do "i" poligonal | Engrossamento com `getFillPath` em baixa precisão | `resScale` alto (12) no stroker, já no script |
| Facetas sutis em ampliação grande | Muitas quadráticas curtas herdadas do TrueType | Conversão para cúbicas com `fontTools.qu2cu` (já no `montar`) |
| Letras "inchadas" ou finas demais | Peso errado ou traço extra não modelado | Teste outros pesos; deixe `ajustar_traco` ligado |
| Um peso "extrapolado" parece melhor no número | Extrapolar o eixo de peso engrossa só na horizontal | Use engrossamento uniforme (o do script), não extrapole o eixo |
| Rasterização com buracos | Regra par/ímpar em letras com contornos cruzados | O script usa regra de winding |
| PNG de fonte com fundo opaco | Sem canal alfa, tudo vira "tinta" | Remova o fundo antes ou recorte por cor |

## Entrega

- `saida/<marca>-logo.svg` e as variantes: entregue numa pasta `logo/` do projeto, com nomes claros (`marca-logo-fundo-escuro.svg`, `marca-logo-fundo-claro.svg`, `marca-simbolo-roxo.svg`).
- `saida/logo-data.js` (`window.LOGO`): vetores oficiais por letra, mais o contorno puro de cada letra e o glifo completo do símbolo. É a entrada da skill `motion-de-logo`.
- PNGs para uso comum: renderize os SVGs abrindo o arquivo direto no Chromium (`page.goto(svg)` com `omit_background=True`). Montar HTML com `<img src="file://...">` via `set_content` falha em silêncio e gera imagem quebrada; confira sempre se o PNG tem pixels.
- Diga ao usuário qual fonte foi identificada, o traço extra encontrado e o IoU, e mostre a página de comparação.
