// Gravador de tela para o vídeo: computador e celular, com toque visível e marcas de tempo.
// Uso: veja capture/gravar.mjs. Precisa de `playwright` e do Chrome instalado (channel 'chrome'),
// e do ffmpeg no PATH.
//
// O que ele resolve (cada item custou horas):
// - Celular nítido: o recordVideo do Playwright grava em pixels CSS (390 de largura) e fica borrado;
//   aqui o celular vem do screencast do Chrome (CDP), na densidade do aparelho.
// - O screencast só manda quadro quando a tela muda: a gravação "encolhe" nas pausas. Cada quadro dura
//   até o próximo (concat com duration) e o último quadro é estendido (tpad) para sobrar folga no fim.
// - O webm do recordVideo não tem índice de busca: o Remotion trava procurando quadros nele. O
//   computador sai convertido para mp4 com quadro-chave a cada 1 s.
// - As marcas são o segundo do ARQUIVO (desde o início da gravação), não do relógio do roteiro.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, devices } from 'playwright';

/**
 * Ajustes injetados em toda página: esconde elementos que não são da demonstração, troca textos
 * (ex.: localhost pelo endereço de produção) e desenha um círculo onde há toque ou clique.
 */
function ajustes({ esconder, trocas }) {
  const estilo = document.createElement('style');
  estilo.textContent =
    `${esconder.join(',')}{display:none!important}` +
    '.toque-video{position:fixed;z-index:2147483647;pointer-events:none;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;' +
    'background:rgba(242,148,0,.45);border:3px solid rgba(242,148,0,.95);animation:toque-video .6s ease-out forwards}' +
    '@keyframes toque-video{from{transform:scale(.5);opacity:1}to{transform:scale(1.5);opacity:0}}';
  const aplicar = () => {
    if (!document.body) return;
    if (!estilo.isConnected) document.head?.appendChild(estilo);
    if (!trocas.length) return;
    const andar = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = andar.nextNode(); n; n = andar.nextNode()) {
      for (const [de, para] of trocas) if (n.nodeValue.includes(de)) n.nodeValue = n.nodeValue.replaceAll(de, para);
    }
  };
  setInterval(aplicar, 150);
  addEventListener(
    'pointerdown',
    (e) => {
      const c = document.createElement('div');
      c.className = 'toque-video';
      c.style.left = `${e.clientX}px`;
      c.style.top = `${e.clientY}px`;
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 700);
    },
    true,
  );
}

/**
 * Abre o navegador e devolve `computador(nome)` e `celular(nome)`, cada um com a página (`p`),
 * `marca(nome)` (segundo atual do arquivo) e `fechar()` (gera public/gravacoes/<nome>.mp4).
 */
export async function abrirGravador({
  base,
  saida = path.resolve('public/gravacoes'),
  esconder = ['nextjs-portal'],
  trocas = [],
  folgaFinalS = 5,
  aparelho = 'iPhone 13',
}) {
  const temp = path.join(saida, 'tmp');
  mkdirSync(temp, { recursive: true });
  const arquivoMarcas = path.join(saida, 'marcas.json');
  const marcas = existsSync(arquivoMarcas) ? JSON.parse(readFileSync(arquivoMarcas, 'utf8')) : {};
  const browser = await chromium.launch({
    channel: 'chrome',
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
  });
  const { defaultBrowserType: _ignorado, ...iphone } = devices[aparelho];
  const ffmpeg = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args]);

  async function screencast(ctx, p, nome) {
    const pasta = path.join(temp, nome);
    mkdirSync(pasta, { recursive: true });
    const cdp = await ctx.newCDPSession(p);
    const quadros = [];
    cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
      const arquivo = path.join(pasta, `q${String(quadros.length).padStart(6, '0')}.jpg`);
      writeFileSync(arquivo, Buffer.from(data, 'base64'));
      quadros.push({ arquivo, t: metadata.timestamp * 1000 });
      await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    });
    const { width, height } = p.viewportSize();
    const escala = iphone.deviceScaleFactor ?? 2;
    const [w, h] = [width * escala, height * escala];
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: w, maxHeight: h, everyNthFrame: 1 });
    return async (inicio, destino) => {
      await cdp.send('Page.stopScreencast').catch(() => {});
      if (!quadros.length) throw new Error(`${nome}: o screencast não mandou nenhum quadro.`);
      const linhas = [];
      quadros.forEach((q, i) => {
        const ate = i + 1 < quadros.length ? quadros[i + 1].t : q.t + 1000;
        const de = i === 0 ? inicio : q.t;
        linhas.push(`file '${q.arquivo.split(path.sep).join('/')}'`, `duration ${Math.max(0.001, (ate - de) / 1000).toFixed(3)}`);
      });
      linhas.push(`file '${quadros.at(-1).arquivo.split(path.sep).join('/')}'`);
      const lista = path.join(pasta, 'lista.txt');
      writeFileSync(lista, linhas.join('\n'));
      ffmpeg([
        '-f', 'concat', '-safe', '0', '-i', lista,
        '-vf', `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:0:color=white,fps=30,tpad=stop_mode=clone:stop_duration=${folgaFinalS}`,
        '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-g', '30', destino,
      ]);
    };
  }

  async function contexto(nome, opcoes, celular) {
    const tamanho = { width: opcoes.viewport.width, height: opcoes.viewport.height };
    const ctx = await browser.newContext({
      permissions: ['microphone'],
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
      ...opcoes,
      ...(celular ? {} : { recordVideo: { dir: temp, size: tamanho } }),
    });
    await ctx.addInitScript(ajustes, { esconder, trocas });
    const p = await ctx.newPage();
    // O screencast não sobrevive à troca de processo de about:blank para o site: abre o site antes.
    if (celular) await p.goto(base);
    const parar = celular ? await screencast(ctx, p, nome) : null;
    delete marcas[nome];
    const inicio = Date.now();
    p.on('pageerror', (e) => console.log(`${nome}: ${e.message}`));
    return {
      p,
      marca(m) {
        const t = +((Date.now() - inicio) / 1000).toFixed(2);
        (marcas[nome] ??= {})[m] = t;
        console.log(`${nome} ${m} ${t}s`);
      },
      async fechar() {
        const destino = path.join(saida, `${nome}.mp4`);
        if (parar) await parar(inicio, destino);
        const video = p.video();
        await ctx.close();
        if (video) {
          const webm = path.join(temp, `${nome}.webm`);
          renameSync(await video.path(), webm);
          // mp4 com quadro-chave a cada 1 s e o último quadro estendido: o Remotion busca rápido e nunca passa do fim.
          ffmpeg(['-i', webm, '-vf', `fps=30,tpad=stop_mode=clone:stop_duration=${folgaFinalS}`, '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-g', '30', destino]);
        }
        writeFileSync(arquivoMarcas, JSON.stringify(marcas, null, 2));
        console.log('vídeo', destino);
      },
    };
  }

  return {
    computador: (nome, viewport = { width: 1600, height: 900 }) => contexto(nome, { viewport }, false),
    celular: (nome) => contexto(nome, { ...iphone, deviceScaleFactor: 2 }, true),
    fechar: () => browser.close(),
  };
}

/** Digita como gente (o texto aparece aos poucos no vídeo). */
export const digitar = (campo, texto) => campo.pressSequentially(texto, { delay: 90 });

/** Rola a página devagar até o elemento (scrollIntoView pula de uma vez). */
export async function rolarAte(p, alvo, passos = 24) {
  const y = await alvo.evaluate((el) => el.getBoundingClientRect().top + scrollY - 140);
  const y0 = await p.evaluate(() => scrollY);
  for (let i = 1; i <= passos; i++) {
    await p.evaluate(([a, b, k]) => scrollTo(0, a + (b - a) * (1 - Math.pow(1 - k, 3))), [y0, y, i / passos]);
    await p.waitForTimeout(60);
  }
}
