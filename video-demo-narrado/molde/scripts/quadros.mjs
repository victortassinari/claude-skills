// Quadros parados para conferir o enquadramento antes do render completo (bem mais rápido).
//   node scripts/quadros.mjs [pasta]                       9 quadros espalhados, nos dois formatos
//   QUADROS='[10,400,-30]' node scripts/quadros.mjs [pasta] quadros escolhidos; negativo conta do fim
// Depois, uma folha de contato: ffmpeg -f concat -i lista.txt -vf "scale=640:-1,tile=3x3" -frames:v 1 folha.jpg
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { openBrowser, renderStill, selectComposition } from '@remotion/renderer';

const saida = path.resolve(process.argv[2] ?? `out/quadros-${Date.now()}`);
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
// Um navegador só para todos os quadros (abrir um por quadro falha às vezes no Windows).
const puppeteerInstance = await openBrowser('chrome');
for (const id of ['Horizontal', 'Vertical']) {
  const composition = await selectComposition({ serveUrl, id, puppeteerInstance });
  const pedidos = JSON.parse(process.env.QUADROS ?? 'null');
  const quadros = pedidos
    ? pedidos.map((q) => (q < 0 ? composition.durationInFrames + q : q))
    : Array.from({ length: 9 }, (_, i) => Math.round(((i + 0.5) / 9) * composition.durationInFrames));
  for (const frame of quadros) {
    const output = path.join(saida, `${id}-${String(frame).padStart(5, '0')}.jpg`);
    await renderStill({ serveUrl, composition, frame, output, puppeteerInstance, imageFormat: 'jpeg', jpegQuality: 80, scale: 0.5 });
    console.log(output);
  }
}
await puppeteerInstance.close({ silent: true });
