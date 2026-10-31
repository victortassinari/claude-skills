#!/usr/bin/env python3
"""Vetoriza um logo tipográfico a partir de um PNG, reconstruindo-o com os contornos reais da fonte.

Subcomandos:
  inspecionar  <logo.png>            cores dominantes e componentes conectados (para escrever o config)
  ajustar      <config.json>         encaixa letras, glifos e círculos no PNG (gera ajuste.json)
  montar       <config.json>         gera os SVGs (curvas cúbicas) e os dados por letra para animação
  verificar    <config.json>         renderiza o SVG no tamanho do PNG e mede a fidelidade (gera diff.png)

Dependências: pip install numpy scipy pillow matplotlib fonttools skia-python playwright
              python -m playwright install chromium   (só para "verificar")
"""
import json, math, sys, pathlib
import numpy as np


# ------------------------------------------------------------------ util
def carregar_config(caminho):
    cfg = json.load(open(caminho, encoding='utf-8'))
    base = pathlib.Path(caminho).resolve().parent
    cfg['_base'] = base
    cfg['_saida'] = (base / cfg.get('saida', 'saida')).resolve()
    cfg['_saida'].mkdir(parents=True, exist_ok=True)
    return cfg


def hex_rgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)


def ler_png(caminho):
    from PIL import Image
    im = Image.open(caminho).convert('RGBA')
    return np.asarray(im).astype(float)


# ------------------------------------------------------------------ inspecionar
def inspecionar(png):
    from collections import Counter
    from scipy import ndimage
    im = ler_png(png)
    H, W = im.shape[:2]
    A = im[..., 3]
    fundo_opaco = (A > 250).mean() > 0.97
    print(f'tamanho {W}x{H} | fundo {"opaco (remova o fundo ou use a cor de fundo no config)" if fundo_opaco else "transparente"}')
    px = im[A > 240][:, :3].astype(int)
    cores = Counter(map(tuple, (px // 8) * 8)).most_common(8)
    print('cores dominantes (aproximadas):')
    for c, n in cores:
        print(f'  #{c[0]:02X}{c[1]:02X}{c[2]:02X}  {n} px')
    for c, _ in cores[:4]:
        m = (np.abs(im[..., :3] - np.array(c)).sum(-1) < 60) & (A > 128)
        lab, n = ndimage.label(m)
        caixas = [s for s in ndimage.find_objects(lab)]
        print(f'componentes da cor #{c[0]:02X}{c[1]:02X}{c[2]:02X}: {n}')
        for s in sorted(caixas, key=lambda s: s[1].start)[:20]:
            print(f'   x {s[1].start}-{s[1].stop}  y {s[0].start}-{s[0].stop}')


# ------------------------------------------------------------------ fonte
_FONTES = {}


def fonte(cfg, el):
    """Abre a fonte do elemento (ou a padrão), instanciando o peso se for variável."""
    from fontTools.ttLib import TTFont
    from fontTools.varLib.instancer import instantiateVariableFont
    arq = el.get('fonte', cfg.get('fonte'))
    peso = el.get('peso', cfg.get('peso'))
    chave = (arq, peso)
    if chave not in _FONTES:
        f = TTFont(cfg['_base'] / arq)
        if 'fvar' in f and peso is not None:
            f = instantiateVariableFont(f, {'wght': peso}, inplace=False)
        if 'glyf' in f:
            # fontes variáveis costumam desenhar letras com contornos sobrepostos (a bacia e a haste do "a" separadas);
            # sem unir, "so_externo" pega só a maior peça e o glifo sai mutilado
            from fontTools.ttLib.removeOverlaps import removeOverlaps
            removeOverlaps(f)
        _FONTES[chave] = f
    return _FONTES[chave]


def operacoes_glifo(f, ch):
    from fontTools.pens.recordingPen import DecomposingRecordingPen
    gs = f.getGlyphSet()
    nome = f.getBestCmap()[ord(ch)]
    pen = DecomposingRecordingPen(gs)
    gs[nome].draw(pen)
    return pen.value, gs[nome].width, f['hmtx'][nome][1]


def achatar(ops, n=16):
    """Operações de caneta -> lista de contornos (arrays Nx2) em unidades da fonte."""
    conts, cur = [], []
    def bez(p, t):
        k = len(p) - 1
        return sum(math.comb(k, i) * (1 - t) ** (k - i) * t ** i * np.array(p[i]) for i in range(k + 1))
    for op, args in ops:
        if op == 'moveTo':
            cur = [np.array(args[0], float)]
        elif op == 'lineTo':
            cur.append(np.array(args[0], float))
        elif op == 'curveTo':
            p = [cur[-1]] + [np.array(a, float) for a in args]
            cur += [bez(p, t) for t in np.linspace(0, 1, n)[1:]]
        elif op == 'qCurveTo':
            pts = [np.array(a, float) for a in args if a is not None]
            fechado = args[-1] is None
            if fechado:  # contorno só de pontos fora da curva
                ini = (pts[-1] + pts[0]) / 2
                cur = [ini]; pts = pts + [ini]
            p0 = cur[-1]
            for i in range(len(pts) - 1):
                c = pts[i]
                fim = pts[i + 1] if i == len(pts) - 2 else (pts[i] + pts[i + 1]) / 2
                cur += [bez([p0, c, fim], t) for t in np.linspace(0, 1, n)[1:]]
                p0 = fim
        elif op in ('closePath', 'endPath'):
            if len(cur) > 2:
                conts.append(np.array(cur))
            cur = []
    return conts


def area(c):
    return 0.5 * np.sum(c[:, 0] * np.roll(c[:, 1], -1) - np.roll(c[:, 0], -1) * c[:, 1])


def so_externo(conts):
    return [max(conts, key=lambda c: abs(area(c)))]


# ------------------------------------------------------------------ raster
def mascara(conts_px, caixa, ss):
    """Máscara booleana em alta resolução (ss x) dentro da caixa [x0,y0,x1,y1], regra de winding."""
    from matplotlib.path import Path
    x0, y0, x1, y1 = caixa
    xs = x0 + (np.arange((x1 - x0) * ss) + .5) / ss
    ys = y0 + (np.arange((y1 - y0) * ss) + .5) / ss
    X, Y = np.meshgrid(xs, ys)
    P = np.c_[X.ravel(), Y.ravel()]
    w = np.zeros(len(P))
    for c in conts_px:
        bb = (P[:, 0] >= c[:, 0].min()) & (P[:, 0] <= c[:, 0].max()) & (P[:, 1] >= c[:, 1].min()) & (P[:, 1] <= c[:, 1].max())
        idx = np.where(bb)[0]
        if len(idx):
            w[idx] += np.sign(area(c)) * Path(c).contains_points(P[idx])
    return (w != 0).reshape(len(ys), len(xs))


def cobertura(conts_px, caixa, d=0.0, ss=6):
    """Cobertura 0..1 por pixel, com engrossamento (d>0) ou afinamento (d<0) uniforme do traço em px."""
    from scipy import ndimage
    m = mascara(conts_px, caixa, ss)
    if abs(d) > 1e-3:
        m = ndimage.distance_transform_edt(~m) <= d * ss if d > 0 else ndimage.distance_transform_edt(m) > -d * ss
    h, w = m.shape[0] // ss, m.shape[1] // ss
    return m.reshape(h, ss, w, ss).mean(axis=(1, 3))


# ------------------------------------------------------------------ alvo
def alvos(cfg, im):
    """Para cada elemento, a cobertura do PNG atribuída à cor mais próxima, recortada na região do elemento."""
    A = im[..., 3] / 255
    els = cfg['elementos']
    cores = np.stack([hex_rgb(e['cor']) for e in els])
    dist = np.linalg.norm(im[..., None, :3] - cores[None, None], axis=-1)
    mais_prox = dist.argmin(-1)
    H, W = A.shape
    out = []
    for i, e in enumerate(els):
        same = [j for j, o in enumerate(els) if o['cor'].lower() == e['cor'].lower()]
        t = np.where(np.isin(mais_prox, same), A, 0)
        x0, y0, x1, y1 = e.get('regiao', [0, 0, W, H])
        r = np.zeros_like(t); r[y0:y1, x0:x1] = t[y0:y1, x0:x1]
        out.append(r)
    return out


def caixa_tinta(t, pad=4):
    ys, xs = np.where(t > 0.5)
    H, W = t.shape
    return [max(0, xs.min() - pad), max(0, ys.min() - pad), min(W, xs.max() + 1 + pad), min(H, ys.max() + 1 + pad)]


# ------------------------------------------------------------------ geometria por tipo de elemento
def geometria(cfg, el):
    """Contornos (unidades da fonte) por letra, avanços e lsb, para 'texto' e 'glifo'."""
    f = fonte(cfg, el)
    texto = el['texto'] if el['tipo'] == 'texto' else el['char']
    letras = []
    for ch in texto:
        if ch == ' ':
            letras.append(None); continue
        ops, adv, lsb = operacoes_glifo(f, ch)
        conts = achatar(ops)
        if el['tipo'] == 'glifo' and el.get('so_externo', True):
            conts = so_externo(conts)
        letras.append(dict(ch=ch, ops=ops, conts=conts, adv=adv, lsb=lsb))
    return letras


def posicionar(letras, p, tipo):
    """p = [d, s, y0, dx...] -> contornos em px."""
    d, s, y0 = p[:3]
    dxs = p[3:]
    out, k = [], 0
    for L in letras:
        if L is None:
            continue
        dx = dxs[k] if tipo == 'texto' else dxs[0]
        out += [np.c_[dx + s * c[:, 0], y0 - s * c[:, 1]] for c in L['conts']]
        k += 1
    return out


def chute_inicial(letras, alvo, el):
    x0, y0, x1, y1 = caixa_tinta(alvo, 0)
    todos = np.concatenate([c for L in letras if L for c in L['conts']])
    s = (y1 - y0) / max(1, todos[:, 1].max() - todos[:, 1].min())
    if el['tipo'] == 'texto':
        # largura da palavra em unidades com avanços: corrige a escala pela largura também
        larg_u = sum(L['adv'] for L in letras if L) - letras[0]['lsb']
        s = 0.5 * (s + (x1 - x0) / max(1, larg_u * 0.98))
    base = y1 + s * todos[:, 1].min()
    dxs, cur = [], x0 - s * (letras[0]['lsb'] if letras[0] else 0)
    for L in letras:
        if L is None:
            cur += s * 250; continue
        dxs.append(cur); cur += s * L['adv']
    if el['tipo'] == 'glifo':
        dxs = [x0 - s * todos[:, 0].min()]
    return [0.3, s, base] + dxs


# ------------------------------------------------------------------ ajustar
def ajustar(cfg_path):
    from scipy.optimize import minimize
    cfg = carregar_config(cfg_path)
    im = ler_png(cfg['_base'] / cfg['png'])
    T = alvos(cfg, im)
    resultado = {}
    for el, alvo in zip(cfg['elementos'], T):
        nome = el['nome']
        if alvo.sum() < 5:
            print(f'{nome}: sem pixels dessa cor na região, confira cor e regiao'); continue
        caixa = caixa_tinta(alvo, 6)
        sub = alvo[caixa[1]:caixa[3], caixa[0]:caixa[2]]
        if el['tipo'] == 'circulo':
            ys, xs = np.where(alvo > .5)
            p0 = [xs.mean() + .5, ys.mean() + .5, math.sqrt((alvo > .5).sum() / math.pi)]
            def cob_c(p):
                cx, cy, r = p; ss = 8
                yy, xx = np.mgrid[caixa[1] * ss:caixa[3] * ss, caixa[0] * ss:caixa[2] * ss]
                m = ((xx + .5) / ss - cx) ** 2 + ((yy + .5) / ss - cy) ** 2 <= r * r
                return m.reshape(sub.shape[0], ss, sub.shape[1], ss).mean(axis=(1, 3))
            r = minimize(lambda p: ((cob_c(p) - sub) ** 2).sum(), p0, method='Powell')
            resultado[nome] = dict(tipo='circulo', cx=r.x[0], cy=r.x[1], r=r.x[2], erro=float(r.fun))
            print(f'{nome}: círculo c=({r.x[0]:.2f},{r.x[1]:.2f}) r={r.x[2]:.2f} erro={r.fun:.2f}')
            continue
        letras = geometria(cfg, el)
        p0 = np.array(chute_inicial(letras, alvo, el), float)
        ajusta_d = el.get('ajustar_traco', True)
        escala = np.array([0.05, p0[1] * 0.01, 0.3] + [0.3] * (len(p0) - 3))
        def erro(q):
            p = q * escala
            if not ajusta_d:
                p[0] = 0
            return ((cobertura(posicionar(letras, p, el['tipo']), caixa, p[0], 4) - sub) ** 2).sum()
        r = minimize(erro, p0 / escala, method='Powell', options=dict(xtol=1e-2, ftol=1e-4, maxfev=int(el.get('max_avaliacoes', 2500))))
        p = r.x * escala
        if not ajusta_d:
            p[0] = 0
        resultado[nome] = dict(tipo=el['tipo'], d=p[0], s=p[1], y0=p[2], dx=list(p[3:]), erro=float(r.fun))
        print(f'{nome}: traço {p[0]:+.3f}px escala {p[1]:.5f} base {p[2]:.2f} erro {r.fun:.2f}')
    json.dump(resultado, open(cfg['_saida'] / 'ajuste.json', 'w'), indent=1)
    print('gravado', cfg['_saida'] / 'ajuste.json')


# ------------------------------------------------------------------ montar (skia)
K = 10.0  # unidades do SVG por pixel do PNG


def skia_caminho(ops, s, dx, y0, so_ext=False):
    import skia
    T = lambda pt: (K * (dx + s * pt[0]), K * (y0 - s * pt[1]))
    conts, cur = [], None
    for op, args in ops:
        if op == 'moveTo':
            cur = skia.Path(); cur.moveTo(*T(args[0]))
        elif op == 'lineTo':
            cur.lineTo(*T(args[0]))
        elif op == 'curveTo':
            cur.cubicTo(*T(args[0]), *T(args[1]), *T(args[2]))
        elif op == 'qCurveTo':
            pts = list(args)
            if pts[-1] is None:
                pts = pts[:-1]
                ini = ((pts[-1][0] + pts[0][0]) / 2, (pts[-1][1] + pts[0][1]) / 2)
                cur = skia.Path(); cur.moveTo(*T(ini)); pts = pts + [ini]
            for i in range(len(pts) - 1):
                nx = pts[i + 1] if i == len(pts) - 2 else ((pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2)
                cur.quadTo(*T(pts[i]), *T(nx))
        elif op in ('closePath', 'endPath'):
            cur.close(); conts.append(cur)
    if so_ext:
        conts = [max(conts, key=lambda c: c.computeTightBounds().width() * c.computeTightBounds().height())]
    out = skia.Path()
    for c in conts:
        out.addPath(c)
    out.setFillType(skia.PathFillType.kWinding)
    return out


def engrossar(path, d):
    """Engrossa o traço d px de cada lado. resScale alto = curvas finas; com valor baixo saem facetas visíveis."""
    import skia
    if d <= 0:
        return path
    paint = skia.Paint(Style=skia.Paint.kStroke_Style, StrokeWidth=2 * d * K, StrokeJoin=skia.Paint.kRound_Join)
    st = skia.Path()
    paint.getFillPath(path, st, None, 12.0)
    return skia.Op(path, st, skia.PathOp.kUnion_PathOp)


def uniao(paths):
    import skia
    b = skia.OpBuilder()
    for p in paths:
        b.add(p, skia.PathOp.kUnion_PathOp)
    return b.resolve()


def para_quadraticas(path):
    """skia.Path -> lista de contornos com segmentos ('L',p0,p1) e ('Q',p0,c,p1); cônicas viram quadráticas."""
    import skia
    conts, segs, cur, ini = [], [], None, None
    it = skia.Path.Iter(path, False)
    while True:
        verb, pts = it.next()
        if verb == skia.Path.kDone_Verb:
            break
        P = lambda p: complex(p.x(), p.y())
        if verb == skia.Path.kMove_Verb:
            cur = ini = P(pts[0]); segs = []
        elif verb == skia.Path.kLine_Verb:
            segs.append(('L', cur, P(pts[1]))); cur = P(pts[1])
        elif verb == skia.Path.kQuad_Verb:
            segs.append(('Q', cur, P(pts[1]), P(pts[2]))); cur = P(pts[2])
        elif verb == skia.Path.kConic_Verb:
            qs = skia.Path.ConvertConicToQuads(pts[0], pts[1], pts[2], it.conicWeight(), 2)
            for i in range(1, len(qs) - 1, 2):
                segs.append(('Q', cur, P(qs[i]), P(qs[i + 1]))); cur = P(qs[i + 1])
        elif verb == skia.Path.kCubic_Verb:
            segs.append(('C', cur, P(pts[1]), P(pts[2]), P(pts[3]))); cur = P(pts[3])
        elif verb == skia.Path.kClose_Verb:
            if abs(cur - ini) > 1e-6:
                segs.append(('L', cur, ini))
            conts.append(segs); cur = ini
    return conts


def svg_d(path, ox=0, oy=0, tol=1.0):
    """Caminho SVG em curvas cúbicas (qu2cu): menos nós e sem facetas visíveis em ampliação."""
    from fontTools.qu2cu import quadratic_to_curves
    f = lambda v: ('%.1f' % v).rstrip('0').rstrip('.')
    pt = lambda z: f(z.real - ox) + ' ' + f(z.imag - oy)
    out = []
    for segs in para_quadraticas(path):
        out.append('M' + pt(segs[0][1]))
        k = 0
        while k < len(segs):
            s = segs[k]
            if s[0] == 'L':
                out.append('L' + pt(s[2])); k += 1; continue
            if s[0] == 'C':
                out.append('C' + ' '.join(pt(z) for z in s[2:])); k += 1; continue
            run = []
            while k < len(segs) and segs[k][0] == 'Q':
                run.append(list(segs[k][1:])); k += 1
            for cv in quadratic_to_curves(run, tol, all_cubic=True):
                out.append('C' + ' '.join(pt(z) for z in cv[1:]))
        out.append('Z')
    return ''.join(out)


def montar(cfg_path):
    import skia
    cfg = carregar_config(cfg_path)
    aj = json.load(open(cfg['_saida'] / 'ajuste.json', encoding='utf-8'))
    pecas, letras_dados = {}, {}
    for el in cfg['elementos']:
        a = aj[el['nome']]
        if a['tipo'] == 'circulo':
            p = skia.Path(); p.addCircle(K * a['cx'], K * a['cy'], K * a['r']); pecas[el['nome']] = p; continue
        letras = geometria(cfg, el)
        d = a['d'] if el.get('engrossar', True) else 0
        caminhos, crus, k = [], [], 0
        for L in letras:
            if L is None:
                continue
            dx = a['dx'][k] if a['tipo'] == 'texto' else a['dx'][0]
            cru = skia_caminho(L['ops'], a['s'], dx, a['y0'], so_ext=(a['tipo'] == 'glifo' and el.get('so_externo', True)))
            crus.append((L['ch'], cru)); caminhos.append((L['ch'], engrossar(cru, d))); k += 1
        pecas[el['nome']] = uniao([c for _, c in caminhos])
        letras_dados[el['nome']] = dict(letras=caminhos, contorno=crus)
        if a['tipo'] == 'glifo':  # o glifo completo (com miolo) na mesma posição, útil para morphs
            dx = a['dx'][0]
            letras_dados[el['nome']]['glifo_completo'] = skia_caminho(letras[0]['ops'], a['s'], dx, a['y0'])
    # caixa total e normalização para começar em 0,0
    rs = [p.computeTightBounds() for p in pecas.values()]
    x0 = min(r.left() for r in rs); y0 = min(r.top() for r in rs)
    W = math.ceil(max(r.right() for r in rs) - x0); H = math.ceil(max(r.bottom() for r in rs) - y0)
    D = {n: svg_d(p, x0, y0) for n, p in pecas.items()}
    cores = {el['nome']: el['cor'] for el in cfg['elementos']}
    marca = cfg.get('nome_marca', 'logo')
    out = cfg['_saida']

    def escrever(nome, mapa_cor, so=None):
        els = [n for n in D if so is None or n in so]
        corpo = ''.join(f'\n  <path id="{n}" fill="{mapa_cor.get(n, cores[n])}" d="{D[n]}"/>' for n in els)
        if so is None:
            vb = f'0 0 {W} {H}'
        else:
            r = [pecas[n].computeTightBounds() for n in els]
            vb = f'{math.floor(min(q.left() for q in r) - x0)} {math.floor(min(q.top() for q in r) - y0)} ' \
                 f'{math.ceil(max(q.right() for q in r) - min(q.left() for q in r))} {math.ceil(max(q.bottom() for q in r) - min(q.top() for q in r))}'
        (out / f'{nome}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="{marca}">{corpo}\n</svg>\n', encoding='utf-8')
        print('gravado', out / f'{nome}.svg')

    escrever(f'{marca}-logo', {})
    for v in cfg.get('variantes', []):
        mapa = {n: v['cor'] for n in D} if 'cor' in v else v.get('cores', {})
        escrever(f'{marca}-{v["nome"]}', mapa, v.get('elementos'))
    # dados por letra para animação (vetores oficiais + contorno puro, sem engrossar)
    dados = dict(viewBox=[0, 0, W, H], cores=cfg.get('paleta', {}), logo=D, letras={}, letrasContorno={}, glifos={})
    for n, L in letras_dados.items():
        dados['letras'][n] = [dict(char=ch, d=svg_d(p, x0, y0)) for ch, p in L['letras']]
        dados['letrasContorno'][n] = [dict(char=ch, d=svg_d(p, x0, y0)) for ch, p in L['contorno']]
        if 'glifo_completo' in L:
            dados['glifos'][n] = svg_d(L['glifo_completo'], x0, y0)
    js = f'/* Vetores oficiais do logo {marca}. viewBox 0 0 {W} {H}. Gerado por vetorizar.py. */\nwindow.LOGO = {json.dumps(dados, ensure_ascii=False)};\n'
    (out / 'logo-data.js').write_text(js, encoding='utf-8')
    (out / 'logo-data.json').write_text(json.dumps(dados, ensure_ascii=False, indent=1), encoding='utf-8')
    json.dump(dict(x0=x0, y0=y0, K=K, W=W, H=H), open(out / 'normalizacao.json', 'w'))
    print(f'viewBox 0 0 {W} {H} | logo-data.js com {sum(len(v) for v in dados["letras"].values())} letras')


# ------------------------------------------------------------------ verificar
def verificar(cfg_path):
    from PIL import Image
    from playwright.sync_api import sync_playwright
    cfg = carregar_config(cfg_path)
    out = cfg['_saida']; marca = cfg.get('nome_marca', 'logo')
    O = ler_png(cfg['_base'] / cfg['png']); H, W = O.shape[:2]
    nz = json.load(open(out / 'normalizacao.json'))
    svg = (out / f'{marca}-logo.svg').read_text(encoding='utf-8')
    # posiciona o SVG normalizado de volta sobre o PNG original
    vb = f'{-nz["x0"]:.3f} {-nz["y0"]:.3f} {W * K} {H * K}'
    svg = svg.replace(f'viewBox="0 0 {nz["W"]} {nz["H"]}"', f'viewBox="{vb}" width="{W}" height="{H}"', 1)
    html = '<body style="margin:0;background:transparent">' + svg
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={'width': W, 'height': H})
        pg.set_content(html); pg.screenshot(path=str(out / 'render.png'), omit_background=True)
        z = 6; pg.set_viewport_size({'width': W * z, 'height': H * z})
        pg.set_content(html.replace(f'width="{W}" height="{H}"', f'width="{W * z}" height="{H * z}"'))
        pg.screenshot(path=str(out / 'ampliado-6x.png'), omit_background=True); b.close()
    R = np.asarray(Image.open(out / 'render.png').convert('RGBA')).astype(float)
    ra, oa = R[..., 3] / 255, O[..., 3] / 255
    iou = ((ra > .5) & (oa > .5)).sum() / max(1, ((ra > .5) | (oa > .5)).sum())
    mae = np.abs(ra - oa).mean()
    sol = oa > .9
    cor = np.abs(R[..., :3][sol] - O[..., :3][sol]).mean() if sol.any() else 0
    d = np.zeros(ra.shape + (3,)); d[..., 0] = np.clip(oa - ra, 0, 1); d[..., 1] = np.clip(ra - oa, 0, 1); d[..., 2] = np.minimum(ra, oa) * .35
    Image.fromarray((d * 255).astype('uint8')).resize((W * 5, H * 5), Image.NEAREST).save(out / 'diff.png')
    print(f'IoU {iou:.4f} | erro médio de alfa {mae:.4f} | diferença de cor nos pixels sólidos {cor:.1f}/255')
    print('diff.png: vermelho = falta no SVG, verde = sobra no SVG; ampliado-6x.png: confira se as bordas são lisas')
    print('referência: IoU acima de 0,92 em PNG pequeno (até 300 px) já é encaixe fiel; a diferença restante costuma ser antisserrilhado')


if __name__ == '__main__':
    if len(sys.argv) < 3 or sys.argv[1] not in ('inspecionar', 'ajustar', 'montar', 'verificar'):
        print(__doc__); sys.exit(1)
    {'inspecionar': inspecionar, 'ajustar': ajustar, 'montar': montar, 'verificar': verificar}[sys.argv[1]](sys.argv[2])
