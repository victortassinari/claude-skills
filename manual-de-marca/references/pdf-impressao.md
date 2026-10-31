# CSS de impressão do manual (PDF A4 deitado)

O manual é um HTML para tela; o PDF sai do mesmo HTML com `@media print`. Regras que resolveram cada problema real:

```css
@media print {
  @page { size: 297mm 210mm; margin: 11mm 0 13mm 0 }
  @page :first { margin: 0 }                      /* capa sangrando */
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact }
  .capa { height: 210mm; break-after: page }
  .sumario { display: block; break-after: page }  /* sumário existe só no PDF */
  .cap { break-before: page; padding-block: 4mm 0 } /* cada capítulo em página nova, sem sobra no fim */
  .cap-cab, .sub > header { break-after: avoid }  /* título nunca sozinho no pé da página */
  /* nenhum bloco partido ao meio */
  figure, tr, .card, .peca, .cor, .sub, .duo, .mock { break-inside: avoid }
  /* fundo de grade (gap colorido) vira borda: senão sobra um retângulo colorido vazio quando um card muda de página */
  .grade-com-gap { background: transparent !important; gap: 10px !important }
  .grade-com-gap > * { border: 1px solid var(--linha) }
  /* acentos de maiúsculas passam acima da caixa da linha e "sobram" na página anterior */
  h2, h3 { padding-top: 6px; line-height: 1.3 }
  /* elementos de tela */
  .so-tela, button, textarea, .links-download { display: none !important }
  .so-pdf { display: block }
}
```

Problemas e causas:

| Sintoma no PDF | Causa | Correção |
|---|---|---|
| Página em branco entre capítulos | padding inferior do capítulo + `break-before` do próximo | `padding-bottom: 0` no capítulo |
| Retângulo lilás/cinza vazio | grade com `background` no contêiner e `gap` como linha; o card foi para a próxima página | fundo transparente + borda nos cards, só no print |
| Um caractere solto (Á, É) no pé da página | acento acima da caixa de linha do título que abriu a página seguinte | `padding-top` e `line-height` maiores nos títulos |
| Card de mockup cortado ao meio | `break-inside` só no contêiner externo | `break-inside: avoid` nos filhos (cartões, celular, post) e tamanhos menores no print |
| Fileira de cards sozinha numa página | blocos altos demais para A4 | reduza `aspect-ratio` e padding no print |
| Sumário com páginas erradas | números chutados | duas passadas: gerar, achar o `<h2>` de cada capítulo no texto do PDF, preencher, gerar de novo (`scripts/pdf_manual.py`) |

Depois de gerar: `pdf_manual.py` lista páginas quase vazias, texto grande no pé da página e capítulos não localizados. **Isso não substitui olhar.** Monte folhas de contato (8 páginas por imagem) e inspecione todas. Corrija e gere de novo até não sobrar nada.
