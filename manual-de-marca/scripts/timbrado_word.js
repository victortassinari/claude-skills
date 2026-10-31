// Papel timbrado em Word (.docx) com cabeçalho e rodapé de verdade e estilos da marca na galeria do Word.
// Uso: node timbrado_word.js config.json   (precisa de: npm install docx@9 na pasta do script ou do projeto)
//
// config.json:
// {
//   "saida": "marca_papel-timbrado.docx",
//   "logo_png": "logo-fundo-claro.png", "logo_largura_mm": 44,      // PNG transparente, renderizado do SVG
//   "faixa_png": "faixa.png",                                       // opcional: faixa de rodapé 210 x 7 mm (ponta a ponta)
//   "grafismo_png": "simbolo-claro.png", "grafismo_mm": 68,         // opcional: grafismo atrás do texto, canto inferior direito
//   "site": "marca.com.br",
//   "endereco": "Rua Tal, 100 · Cidade, UF · 00000-000",
//   "fontes": { "texto": "Nunito", "titulo": "Comfortaa" },
//   "cores": { "titulo": "2C0142", "acento": "F73C07", "secundaria": "6A009E", "texto": "3B2D4A", "apoio": "8E78A6" },
//   "cidade": "Cidade"
// }
// Depois rode word_embutir_fontes.ps1 para embutir as fontes e gerar o .dotx (modelo).
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Header, Footer, TabStopType,
  HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom, TextWrappingType, BorderStyle,
} = require('docx');

const cfgPath = process.argv[2];
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const base = path.dirname(path.resolve(cfgPath));
const ler = (p) => fs.readFileSync(path.resolve(base, p));
const { imageSize } = (() => {
  // dimensões do PNG direto do cabeçalho IHDR, sem dependência extra
  return { imageSize: (buf) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }) };
})();

const MM = 56.6929, EMU_MM = 36000;
const px = (mm) => Math.round(mm * 96 / 25.4);
const C = cfg.cores, F = cfg.fontes;

const logo = ler(cfg.logo_png); const ls = imageSize(logo); const lw = cfg.logo_largura_mm || 44;
const flutuante = (data, wmm, hmm, xmm, ymm, nome) => new ImageRun({
  type: 'png', data, transformation: { width: px(wmm), height: px(hmm) },
  floating: {
    horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: Math.round(xmm * EMU_MM) },
    verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: Math.round(ymm * EMU_MM) },
    wrap: { type: TextWrappingType.NONE }, behindDocument: true, allowOverlap: true,
  },
  altText: { title: nome, description: nome, name: nome },
});

const rodapeRuns = [new TextRun({ text: cfg.endereco || '', font: F.texto, size: 15, color: C.apoio })];
if (cfg.faixa_png) rodapeRuns.push(flutuante(ler(cfg.faixa_png), 210, 7, 0, 290, 'Faixa institucional'));
if (cfg.grafismo_png) {
  const g = ler(cfg.grafismo_png); const gs = imageSize(g); const gw = cfg.grafismo_mm || 68;
  rodapeRuns.push(flutuante(g, gw, gw * gs.h / gs.w, 210 - gw * 0.82, 297 - gw * 1.12, 'Grafismo'));
}

const p = (text, o = {}) => new Paragraph({ style: o.style || 'Normal', spacing: o.spacing, children: [new TextRun({ text, ...(o.run || {}) })] });
const estilo = (id, name, run, paragraph) => ({ id, name, basedOn: 'Normal', next: 'Normal', quickFormat: true, run, paragraph });

const doc = new Document({
  creator: cfg.site || '', title: 'Papel timbrado',
  styles: {
    default: { document: { run: { font: F.texto, size: 22, color: C.texto }, paragraph: { spacing: { line: 384, after: 160 } } } },
    paragraphStyles: [
      estilo('Title', 'Title', { font: F.titulo, bold: true, size: 40, color: C.titulo }, { spacing: { before: 120, after: 240, line: 300 } }),
      estilo('Heading1', 'Heading 1', { font: F.titulo, bold: true, size: 28, color: C.titulo }, { spacing: { before: 360, after: 120, line: 300 }, outlineLevel: 0 }),
      estilo('Heading2', 'Heading 2', { font: F.titulo, bold: true, size: 24, color: C.secundaria }, { spacing: { before: 240, after: 80, line: 300 }, outlineLevel: 1 }),
      estilo('Rotulo', 'Rótulo', { font: F.texto, bold: true, size: 16, color: C.acento, allCaps: true, characterSpacing: 30 }, { spacing: { after: 60 } }),
      estilo('Destaque', 'Destaque', { font: F.texto, size: 22, color: C.titulo }, { indent: { left: Math.round(4 * MM) }, border: { left: { style: BorderStyle.SINGLE, size: 18, color: C.acento, space: 8 } } }),
      estilo('Assinatura', 'Assinatura', { font: F.titulo, bold: true, size: 22, color: C.titulo }, { spacing: { before: 480, after: 0 } }),
    ],
  },
  sections: [{
    properties: { page: {
      size: { width: Math.round(210 * MM), height: Math.round(297 * MM) },
      margin: { top: Math.round(40 * MM), bottom: Math.round(30 * MM), left: Math.round(20 * MM), right: Math.round(20 * MM), header: Math.round(14 * MM), footer: Math.round(14 * MM) },
    } },
    headers: { default: new Header({ children: [
      new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: Math.round(170 * MM) }], children: [
        new ImageRun({ type: 'png', data: logo, transformation: { width: px(lw), height: px(lw * ls.h / ls.w) }, altText: { title: 'Logo', description: 'Logotipo', name: 'logo' } }),
        new TextRun({ text: '\t' + (cfg.site || ''), font: F.texto, size: 17, color: C.apoio }),
      ] }),
    ] }) },
    footers: { default: new Footer({ children: [new Paragraph({ children: rodapeRuns })] }) },
    children: [
      p(`${cfg.cidade || '[Cidade]'}, [dia] de [mês] de [ano].`, { spacing: { after: 360 } }),
      p('Assunto', { style: 'Rotulo' }),
      p('[Título do documento]', { style: 'Title' }),
      p('Prezada [nome],'),
      p(`[Escreva aqui o corpo do documento. Este modelo já vem com os estilos da marca: ${F.texto} 11 pt no texto, ${F.titulo} nos títulos, entrelinha 1,6 e margens de 20 mm nas laterais. Use a galeria de estilos do Word (Título, Título 1, Título 2, Rótulo, Destaque e Assinatura).]`),
      p('[Apague os textos entre colchetes. O cabeçalho e o rodapé se repetem sozinhos em todas as páginas.]'),
      p('[Uma frase de destaque, quando precisar chamar atenção para um ponto importante.]', { style: 'Destaque' }),
      p('Atenciosamente,', { spacing: { before: 240 } }),
      p('[Nome Sobrenome]', { style: 'Assinatura' }),
      p('[Cargo]', { run: { color: C.apoio, size: 20 } }),
    ],
  }],
});

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(path.resolve(base, cfg.saida), buf); console.log('gravado', cfg.saida, buf.length, 'bytes'); });
