// Roteiro de gravação (exemplo: adapte as ações ao app). Rode de dentro da pasta do vídeo:
//   VIDEO_BASE=http://localhost:3000 node capture/gravar.mjs
// Saída: public/gravacoes/desktop.mp4, public/gravacoes/celular.mp4 e marcas.json, com o segundo de
// cada momento em cada arquivo. Copie esses segundos para os trechos de src/roteiro.ts.
// Grave contra o build de produção (`next start`) ou com o servidor já aquecido: a primeira
// compilação do modo de desenvolvimento aparece no vídeo como tela em branco.
import { abrirGravador, digitar, rolarAte } from './gravador.mjs';

const base = process.env.VIDEO_BASE ?? 'http://localhost:3000';
const gravador = await abrirGravador({
  base,
  // Elementos que não são da demonstração (indicador do Next, botões de feedback, selos de ambiente).
  esconder: ['nextjs-portal'],
  // Textos trocados na tela gravada (ex.: localhost pelo endereço real).
  trocas: [['localhost:3000', 'app.exemplo.com.br']],
});

// Grave um aparelho de cada vez: os dois juntos disputam CPU e a imagem atrasa.
// Cada passada cria uma conta nova: e-mail com `+` único por aparelho e por rodada.
const rodada = Date.now().toString(36);
for (const [aparelho, abrir] of [['desktop', () => gravador.computador('desktop')], ['celular', () => gravador.celular('celular')]]) {
  const g = await abrir();
  // Aquece a página antes de valer a gravação.
  await g.p.goto(base);
  await g.p.waitForTimeout(3000);
  g.marca('inicio');

  await g.p.getByRole('link', { name: 'Criar conta' }).click();
  await g.p.getByLabel('Nome').waitFor();
  g.marca('cadastro');
  await digitar(g.p.getByLabel('Nome'), 'Ana Souza');
  await digitar(g.p.getByLabel('E-mail'), `ana+${aparelho}-${rodada}@exemplo.com`);
  await g.p.getByRole('button', { name: 'Criar' }).click();
  await g.p.getByRole('heading', { name: 'Início' }).waitFor({ timeout: 60_000 });
  g.marca('principal');
  await rolarAte(g.p, g.p.getByRole('heading', { name: 'Resumo' }));
  await g.p.waitForTimeout(2500);
  g.marca('fim');
  await g.fechar();
}
await gravador.fechar();
