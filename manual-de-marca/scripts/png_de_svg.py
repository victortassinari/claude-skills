#!/usr/bin/env python3
"""Exporta PNGs com fundo transparente a partir de SVGs, abrindo cada SVG direto no Chromium.

Uso: python png_de_svg.py arquivo.svg:1600:saida.png [outro.svg:512:outra.png ...]
     (o número é a largura em px; a altura sai da proporção do viewBox)

Por que abrir o SVG direto: montar uma página com <img src="file://..."> via set_content falha em silêncio
(o Chromium bloqueia file:// a partir de about:blank) e o PNG sai com o ícone de imagem quebrada.
"""
import pathlib, re, sys
from playwright.sync_api import sync_playwright
from PIL import Image

with sync_playwright() as p:
    b = p.chromium.launch()
    for job in sys.argv[1:]:
        src, w, dst = job.rsplit(':', 2) if job.count(':') > 2 else job.split(':')
        src = pathlib.Path(src).resolve(); w = int(w)
        vb = [float(x) for x in re.search(r'viewBox="([^"]+)"', src.read_text(encoding='utf-8')).group(1).split()]
        h = round(w * vb[3] / vb[2])
        pg = b.new_page(viewport={'width': w, 'height': h})
        pg.goto(src.as_uri()); pg.wait_for_timeout(80)
        pg.screenshot(path=dst, omit_background=True); pg.close()
        im = Image.open(dst).convert('RGBA')
        ok = im.getbbox() is not None and im.getpixel((0, 0))[3] == 0
        print(('ok ' if ok else 'CONFIRA ') + f'{dst} {w}x{h}')
    b.close()
