#!/usr/bin/env python3
"""Gera o PDF do manual a partir do HTML, em duas passadas: a primeira descobre a página de cada capítulo,
a segunda grava o sumário com os números. Depois exporta miniaturas de cada página para inspeção visual.

Uso: python pdf_manual.py manual/index.html manual/marca-manual.pdf --rodape "Marca · Manual de Identidade Visual · v1.0"

Contrato com o HTML:
  - cada capítulo é <section id="..."> com um <h2> (o texto do h2 é procurado no PDF)
  - o sumário tem elementos <span class="sum-pg" data-cap="<id da seção>"></span> que recebem o número
  - o CSS de impressão (@media print, @page) já está no HTML: veja references/pdf-impressao.md
"""
import argparse, pathlib, re
from playwright.sync_api import sync_playwright
import fitz  # PyMuPDF

ap = argparse.ArgumentParser()
ap.add_argument('html'); ap.add_argument('pdf')
ap.add_argument('--rodape', default='')
ap.add_argument('--largura', default='297mm'); ap.add_argument('--altura', default='210mm')
ap.add_argument('--miniaturas', default='pdf-paginas')
a = ap.parse_args()
html, pdf = pathlib.Path(a.html).resolve(), pathlib.Path(a.pdf).resolve()

RODAPE = ('<div style="width:100%;font-family:Arial,sans-serif;font-size:8px;color:#888;padding:0 16mm;'
          f'display:flex;justify-content:space-between"><span>{a.rodape}</span>'
          '<span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>')


def render(pg, paginas=None):
    if paginas:
        pg.evaluate("p => document.querySelectorAll('.sum-pg').forEach(e => { e.textContent = String(p[e.dataset.cap] || '').padStart(2, '0') })", paginas)
    pg.pdf(path=str(pdf), width=a.largura, height=a.altura, print_background=True, prefer_css_page_size=True,
           display_header_footer=bool(a.rodape), header_template='<span></span>', footer_template=RODAPE, outline=True, tagged=True)


with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1123, 'height': 794})
    pg.goto(html.as_uri(), wait_until='networkidle')
    pg.evaluate("document.querySelectorAll('img[loading=lazy]').forEach(i => i.loading = 'eager')")
    pg.evaluate("Promise.all([...document.images].map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r })))")
    pg.evaluate("document.fonts.ready")
    pg.wait_for_timeout(1500)
    quebradas = pg.evaluate("[...document.images].filter(i => i.naturalWidth === 0).map(i => i.getAttribute('src'))")
    titulos = pg.evaluate("Object.fromEntries([...document.querySelectorAll('section[id]')].map(s => [s.id, (s.querySelector('h2')||{}).innerText||'']).filter(x => x[1]))")
    pg.emulate_media(media='print')
    render(pg)
    doc = fitz.open(str(pdf)); paginas = {}
    for cap, t in titulos.items():
        frase = re.sub(r'\s+', ' ', t).strip()[:28]
        for i, page in enumerate(doc):
            if i >= 1 and frase and frase in re.sub(r'\s+', ' ', page.get_text()):
                paginas[cap] = i + 1; break
    doc.close()
    render(pg, paginas)
    b.close()

doc = fitz.open(str(pdf))
mini = pathlib.Path(a.miniaturas); mini.mkdir(exist_ok=True)
vazias = []
for i, page in enumerate(doc):
    page.get_pixmap(dpi=55).save(mini / f'p{i + 1:02d}.png')
    if len(page.get_text().strip()) < 60 and not page.get_images():
        vazias.append(i + 1)
grandes_no_pe = sorted({i + 1 for i, page in enumerate(doc) for bl in page.get_text('dict')['blocks'] for l in bl.get('lines', [])
                        for s in l['spans'] if s['bbox'][1] > page.rect.height * 0.91 and s['size'] > 9})
print(f'{doc.page_count} páginas | {pdf.stat().st_size / 1e6:.1f} MB')
print('imagens quebradas no HTML:', quebradas or 'nenhuma')
print('capítulos e páginas:', paginas)
faltando = [c for c in titulos if c not in paginas]
print('capítulos não localizados no PDF:', faltando or 'nenhum')
print('páginas quase vazias (provável quebra ruim):', vazias or 'nenhuma')
print('texto grande no pé da página (possível órfão, acento solto):', grandes_no_pe or 'nenhum')
print(f'miniaturas em {mini}/: abra e olhe TODAS antes de entregar')
