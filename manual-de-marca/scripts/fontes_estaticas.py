"""Gera instâncias estáticas (Regular/Bold/Itálico) de fontes variáveis, com nomes RIBBI corretos para o Word agrupar a família
e fsType 0 (instalável), o que permite embutir a fonte no .docx.

Uso: python fontes_estaticas.py saida/ "Familia|Arquivo[wght].ttf|Regular|400" "Familia|Arquivo[wght].ttf|Bold|700"                                         "Familia|Arquivo-Italic[wght].ttf|Italic|400" ...
"""
import pathlib, sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

OUT = pathlib.Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
JOBS = []
for spec in sys.argv[2:]:
    fam, arq, estilo, peso = spec.split('|')
    JOBS.append((arq, fam, estilo, int(peso), 'Italic' in estilo))
SRC = pathlib.Path('.')
for arq, fam, estilo, peso, italico in JOBS:
    f = instantiateVariableFont(TTFont(SRC / arq), {'wght': peso}, inplace=False)
    for t in ('STAT', 'MVAR', 'HVAR', 'avar', 'fvar', 'gvar'):
        if t in f:
            del f[t]
    nome = f['name']
    ps = f'{fam}-{estilo.replace(" ", "")}'
    completo = f'{fam} {estilo}'
    for rec in list(nome.names):
        if rec.nameID in (16, 17, 25):           # nomes tipográficos e de variação confundem o agrupamento RIBBI do Word
            nome.removeNames(nameID=rec.nameID)
    nome.setName(fam, 1, 3, 1, 0x409); nome.setName(estilo, 2, 3, 1, 0x409)
    nome.setName(f'{fam}-{estilo}-estatica', 3, 3, 1, 0x409)
    nome.setName(completo, 4, 3, 1, 0x409); nome.setName(ps, 6, 3, 1, 0x409)
    os2, head = f['OS/2'], f['head']
    bold = peso >= 700
    os2.usWeightClass = peso
    os2.fsSelection = (os2.fsSelection & ~0b1100001) | (0b100000 if bold else 0) | (0b1 if italico else 0) | (0 if (bold or italico) else 0b1000000)
    head.macStyle = (0b1 if bold else 0) | (0b10 if italico else 0)
    os2.fsType = 0                                  # instalável: permite embutir no documento do Word
    destino = OUT / f'{ps}.ttf'
    f.save(destino)
    print('ok', destino.name)
