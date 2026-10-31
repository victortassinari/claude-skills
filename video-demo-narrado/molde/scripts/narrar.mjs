// Gera a narração de cada cena com a ElevenLabs e mede a duração (que vira a duração da cena).
//   node scripts/narrar.mjs          (de dentro da pasta do vídeo)
// Chave: ELEVENLABS_API_KEY no ambiente ou num arquivo .env (VIDEO_ENV=caminho; padrão ../.env.local
// e depois ~/.elevenlabs.env). Voz: ELEVENLABS_VOICE (padrão Christine, pt-BR). Modelo: ELEVENLABS_MODEL.
// Cache: public/narracao/<id>.mp3 só é gerado de novo se o texto, a voz, o modelo ou as falas vizinhas mudarem.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function lerEnv() {
  const candidatos = [process.env.VIDEO_ENV, path.resolve('../.env.local'), path.join(os.homedir(), '.elevenlabs.env')].filter(Boolean);
  const env = {};
  for (const arquivo of candidatos) {
    if (!existsSync(arquivo)) continue;
    for (const linha of readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
      const i = linha.indexOf('=');
      if (i > 0 && !linha.trim().startsWith('#')) env[linha.slice(0, i).trim()] ??= linha.slice(i + 1).trim();
    }
  }
  return { ...env, ...process.env };
}

const env = lerEnv();
const CHAVE = env.ELEVENLABS_API_KEY;
const VOZ = env.ELEVENLABS_VOICE || 'TOXnXBKJSHqTwwqoWW0D';
const MODELO = env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
// speed 1.0: a versão 1,25x (scripts/finalizar.mjs) já acelera; somar os dois soa apressado.
const AJUSTES = { stability: 0.5, similarity_boost: 0.75, style: 0.1, use_speaker_boost: true, speed: 1.0 };
if (!CHAVE) throw new Error('Falta ELEVENLABS_API_KEY (ambiente, VIDEO_ENV, ../.env.local ou ~/.elevenlabs.env).');

const { FALAS } = await import('../src/falas.mjs');
const pasta = path.resolve('public/narracao');
mkdirSync(pasta, { recursive: true });
const arquivoIndice = path.join(pasta, 'indice.json');
const indice = existsSync(arquivoIndice) ? JSON.parse(readFileSync(arquivoIndice, 'utf8')) : {};
const ids = Object.keys(FALAS);

/** Pedido com novas tentativas: a conexão às vezes estoura o tempo no meio de uma leva. */
async function sintetizar(corpo) {
  for (let tentativa = 1; ; tentativa++) {
    try {
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOZ}?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: { 'xi-api-key': CHAVE, 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify(corpo),
      });
      if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${await r.text()}`);
      return Buffer.from(await r.arrayBuffer());
    } catch (e) {
      if (tentativa >= 4 || /ElevenLabs 4\d\d/.test(String(e))) throw e;
      await new Promise((ok) => setTimeout(ok, 1500 * tentativa));
    }
  }
}

for (const [i, id] of ids.entries()) {
  const texto = FALAS[id];
  // Frase anterior e seguinte: a entonação continua entre as cenas em vez de soar recortada.
  const anterior = i > 0 ? FALAS[ids[i - 1]] : '';
  const seguinte = i < ids.length - 1 ? FALAS[ids[i + 1]] : '';
  const hash = createHash('sha256').update(JSON.stringify([MODELO, VOZ, AJUSTES, texto, anterior, seguinte])).digest('hex').slice(0, 16);
  const mp3 = path.join(pasta, `${id}.mp3`);
  if (indice[id]?.hash !== hash || !existsSync(mp3)) {
    const corpo = { text: texto, model_id: MODELO, voice_settings: AJUSTES };
    if (anterior) corpo.previous_text = anterior;
    if (seguinte) corpo.next_text = seguinte;
    writeFileSync(mp3, await sintetizar(corpo));
    console.log('gerou', id);
  }
  const segundos = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3]).toString().trim());
  indice[id] = { hash, segundos, texto };
}
writeFileSync(arquivoIndice, JSON.stringify(indice, null, 1));
const total = Object.values(indice).reduce((t, x) => t + x.segundos, 0);
console.log(`${ids.length} falas, ${total.toFixed(1)} s, ${Object.values(FALAS).join(' ').length} caracteres`);
