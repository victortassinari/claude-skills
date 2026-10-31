// Acerta o áudio do vídeo renderizado e gera as versões de entrega.
//   node scripts/finalizar.mjs out/video.mp4 [--trilha musica.mp3] [--velocidade 1.25]
// Voz: passa-alta, compressor leve e -16 LUFS (padrão de vídeo na web). Trilha (opcional, música livre
// com crédito no vídeo): -32 LUFS, entra e sai com fade e abaixa sozinha quando há fala (ducking por
// sidechain, ataque 150 ms e retorno 1,2 s: mais rápido que isso a música "bombeia" entre as frases).
// Saída: <nome>-final.mp4 e, com --velocidade, <nome>-final-1.25x.mp4 (imagem e voz juntas; atempo mantém o tom).
import { execFileSync, spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const entrada = args[0]?.startsWith('--') ? undefined : args[0];
const trilha = valor('--trilha');
const velocidade = Number(valor('--velocidade') ?? 0);
if (!entrada) throw new Error('Uso: node scripts/finalizar.mjs out/video.mp4 [--trilha musica.mp3] [--velocidade 1.25]');

function valor(nome) {
  const i = args.indexOf(nome);
  return i >= 0 ? args[i + 1] : undefined;
}
const ffmpeg = (a) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...a], { stdio: ['ignore', 'inherit', 'inherit'] });
const duracao = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', entrada]).toString().trim());
const base = entrada.replace(/\.mp4$/i, '');
const final = `${base}-final.mp4`;

// loudnorm sobe a taxa para 192 kHz: volta para 48 kHz antes de misturar.
const voz = 'highpass=f=70,acompressor=threshold=-22dB:ratio=2:attack=10:release=150,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000';
const filtro = trilha
  ? [
      `[0:a]${voz},asplit=2[vz][sc]`,
      `[1:a]atrim=0:${duracao.toFixed(3)},asetpts=N/SR/TB,loudnorm=I=-32:TP=-9,aresample=48000,` +
        `afade=t=in:st=0:d=2,afade=t=out:st=${Math.max(0, duracao - 4).toFixed(2)}:d=4[m]`,
      '[m][sc]sidechaincompress=threshold=0.03:ratio=4:knee=4:attack=150:release=1200[md]',
      '[vz][md]amix=inputs=2:normalize=0:duration=first[a]',
    ].join(';')
  : `[0:a]${voz}[a]`;
ffmpeg([
  '-i', entrada,
  ...(trilha ? ['-stream_loop', '-1', '-i', trilha] : []),
  '-filter_complex', filtro,
  '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', final,
]);
console.log('final', final);

if (velocidade > 1) {
  const rapido = `${base}-final-${velocidade}x.mp4`;
  ffmpeg([
    '-i', final,
    '-filter_complex', `[0:v]setpts=PTS/${velocidade}[v];[0:a]atempo=${velocidade}[a]`,
    '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', rapido,
  ]);
  console.log('acelerada', rapido);
}

// Confere o volume integrado de cada arquivo (deve ficar perto de -16 LUFS). O ebur128 escreve no stderr.
for (const arquivo of [final, ...(velocidade > 1 ? [`${base}-final-${velocidade}x.mp4`] : [])]) {
  const { stderr } = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', arquivo, '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'], { encoding: 'utf8' });
  const integrado = /I:\s+(-?[\d.]+) LUFS/.exec(stderr)?.[1];
  const pico = /Peak:\s+(-?[\d.]+) dBFS/.exec(stderr)?.[1];
  console.log(`${arquivo}: ${integrado ?? '?'} LUFS integrado${pico ? `, pico ${pico} dBFS` : ''}`);
}
