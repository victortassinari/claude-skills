---
name: manual-de-marca
description: "Cria uma identidade visual completa com manual de marca profissional: manual em HTML interativo e em PDF A4 com sumário, cores, tipografia, construção do logo, área de proteção, usos incorretos, grafismos, fundos para reunião, papéis de parede, capas e posts de LinkedIn, story, slides, assinaturas de e-mail, folder, papel timbrado (também em Word), crachá, pacote ZIP organizado e publicação como site sem indexação. Use sempre que alguém pedir 'manual de marca', 'brand book', 'guia de identidade visual', 'identidade visual completa', 'kit de marca', 'brand kit', 'assets da marca', 'papel timbrado', 'fundo para reunião com a marca', 'assinatura de e-mail da empresa' ou quiser organizar e publicar os arquivos de uma marca, mesmo que peça só uma parte disso."
metadata:
  version: "1.0.0"
---

# Manual de marca

## Visão geral

Um manual que parece de estúdio tem três qualidades: **regras ancoradas na marca real** (cores e fontes tiradas do site, conceito que explica o símbolo, medidas reais do logo), **aplicações prontas para uso** (arquivos nos tamanhos oficiais de cada plataforma) e **acabamento sem defeito** (nenhuma página quebrada, nenhuma imagem faltando). O terceiro ponto é onde se erra: cada entrega precisa ser **olhada** antes de ser declarada pronta.

Pré-requisito: o logo em SVG. Se só existir PNG, use antes a skill `vetorizar-logo`.

## Processo

### 1. Pesquisa (antes de desenhar)

- Baixe o site da marca: HTML, CSS (cores com contagem de uso, `font-family`, Google Fonts) e imagens. Capture prints do site inteiro.
- Anote os grafismos que o site já usa (fotos recortadas numa forma, linhas, padrões). Eles viram o capítulo de elementos gráficos.
- Extraia o posicionamento e a forma de falar da empresa (título do site, seção "sobre", benefícios). Vira o manifesto, os atributos e o capítulo de voz.
- Pergunte só o que não dá para descobrir (por exemplo, se existe outra versão do logo). Versões em outras cores que o usuário mandar são ouro: confirmam a paleta.

### 2. Sistema

Defina tokens (cores com nome próprio, fontes, escala tipográfica) e meça o logo: proporção, unidade x (altura-x), raio do símbolo. Calcule contraste WCAG de cada par de cores; laranja sobre roxo, por exemplo, pode valer só para o logo e nunca para texto.

### 3. Manual HTML

Um único `index.html` gerado por script Python (o conteúdo vem de dados: cores, peças, grafismos), com o logo inline via `<symbol>`/`<use>` para recolorir sem duplicar caminhos. Capítulos e lista de peças: `references/estrutura.md`. Ao desenhar, siga as skills de design disponíveis; evite o visual genérico de IA.

### 4. Peças

Gere cada peça como HTML de tamanho fixo e renderize PNG e, nos impressos, PDF na escala exata (detalhes e armadilha da escala em `references/estrutura.md`). Logos em PNG: `scripts/png_de_svg.py`. Assinaturas de e-mail: tabela HTML com estilos inline e Arial.

**Papel timbrado em Word** (quase sempre pedido):
1. `python scripts/fontes_estaticas.py fontes/ "Familia|Familia[wght].ttf|Regular|400" "Familia|Familia[wght].ttf|Bold|700" ...` gera fontes estáticas com nomes que o Word entende.
2. Instale essas fontes **no usuário** (sem administrador) e avise que fez isso: o Word só embute fontes instaladas.
3. `node scripts/timbrado_word.js config.json` (requer `npm install docx@9`): cabeçalho com logo e site, rodapé com endereço, faixa e grafismo, estilos da marca na galeria.
4. `pwsh -File scripts/word_embutir_fontes.ps1 -Docx arquivo.docx`: embute as fontes, salva `.docx` e `.dotx` e imprime uma página de conferência em PDF. **Olhe a página.**

### 5. PDF do manual

Acrescente o CSS de impressão (`references/pdf-impressao.md`) e rode `python scripts/pdf_manual.py index.html marca-manual.pdf --rodape "Marca · Manual de Identidade Visual · v1.0"`. O script preenche o sumário com páginas reais e aponta páginas vazias e órfãos. Depois **inspecione todas as páginas** em folhas de contato e itere até não haver página em branco, bloco partido, retângulo vazio ou caractere solto.

### 6. Pacote ZIP

Script de empacotamento com pastas numeradas, nomes padronizados e LEIA-ME (`references/estrutura.md`). Inclua as fontes variáveis, as estáticas para instalar e as licenças. Rode de novo sempre que algo mudar.

### 7. Publicar (se pedido)

Site estático com o manual na raiz, a galeria de motions, o PDF e o ZIP, fechado para robôs: `references/publicar.md` e `assets/nginx.conf`. Valide no endereço público, não só localmente.

## Verificação antes de dizer "pronto"

Cada item tem que ter sido **olhado**, não só gerado:
- Manual HTML: sem erro de JavaScript, sem imagem quebrada, sem rolagem horizontal em 1440 px e em 390 px; cada capítulo capturado e olhado.
- PDF: todas as páginas olhadas; sumário com números corretos.
- Cada peça PNG olhada em folha de contato; cada PDF de impresso renderizado e comparado com o PNG.
- PNGs exportados de SVG têm pixels (não são o ícone de imagem quebrada).
- Word aberto no Word, com fontes da marca e cabeçalho e rodapé visíveis.
- ZIP íntegro; publicação conferida por URL, hash e teste de robôs.

Se algo foi só "validado por número" (tamanho de página, código 200), diga isso. Conferir o tamanho do PDF não é conferir o conteúdo, e essa diferença já deixou passar impressos completamente quebrados.

## Ressalvas para dizer ao usuário

- Pantone é aproximação: confirmar em prova de cor.
- Nomes, cargos e contatos nas peças são marcadores.
- Mudanças feitas no computador do usuário (fontes instaladas, arquivos temporários com tokens) e como desfazer.
