"""Valida propostas de motion: abre cada uma com ?embed=1, captura 5 quadros (início, 25%, 50%, 75% e depois do fim)
e registra erros de console. Gera <pasta-de-saida>/<id>_sheet.png para olhar.

Uso: python quadros.py <pasta-motion> <saida> 01-traco-vivo 02-loading ...   (todas, se nenhuma for informada)
     --grande  captura 8 quadros em 1600 x 900 numa grade 2 x 4 (para revisão de qualidade)
Rode UMA validação por vez: cada uma abre um navegador.
"""
import sys, pathlib, re
from playwright.sync_api import sync_playwright
from PIL import Image
args=[a for a in sys.argv[1:] if not a.startswith('--')]
grande='--grande' in sys.argv
R=pathlib.Path(args[0]).resolve(); OUT=pathlib.Path(args[1]); OUT.mkdir(parents=True,exist_ok=True)
ids=args[2:] or sorted(d.name for d in R.iterdir() if (d/'meta.js').exists())
with sync_playwright() as p:
    b=p.chromium.launch()
    for i in ids:
        f=R/i/'index.html'
        if not f.exists(): print(i,'ausente'); continue
        meta=(R/i/'meta.js').read_text(encoding='utf-8') if (R/i/'meta.js').exists() else ''
        m=re.search(r'duracao:\s*"([\d,]+)',meta); dur=float(m.group(1).replace(',','.')) if m else 6
        pg=b.new_page(viewport={'width':1600,'height':900} if grande else {'width':960,'height':540}); errs=[]
        pg.on('pageerror',lambda e: errs.append('ERR '+str(e)[:160])); pg.on('console',lambda m: errs.append(m.type+' '+m.text[:160]) if m.type in('error','warning') else None)
        pg.goto(f.as_uri()+'?embed=1'); 
        times=[dur*f for f in (0.08,0.2,0.33,0.45,0.58,0.72,0.86)]+[dur+0.6] if grande else [0.4, dur*0.25, dur*0.5, dur*0.75, dur+0.6]
        shots=[]; t0=0
        for t in times:
            pg.wait_for_timeout(int((t-t0)*1000)); t0=t
            pth=str(OUT/f'{i}_{t:.1f}.png'); pg.screenshot(path=pth); shots.append(pth)
        pg.close()
        if grande:
            ims=[Image.open(s).resize((800,450)) for s in shots]; S=Image.new('RGB',(2*810,4*460),'#222')
            for k,im in enumerate(ims): S.paste(im,((k%2)*810,(k//2)*460))
        else:
            ims=[Image.open(s).resize((480,270)) for s in shots]; S=Image.new('RGB',(480*5+40,270),'#222')
            for k,im in enumerate(ims): S.paste(im,(k*490,0))
        S.save(OUT/f'{i}_sheet.png'); print(i,'dur',dur,'erros:',errs[:6])
    b.close()
