// Roteiro do vídeo: o que cada cena mostra. Os segundos dos trechos vêm de
// public/gravacoes/marcas.json (gravado por capture/gravar.mjs); a duração de cada cena vem da fala.
import indice from '../public/narracao/indice.json';
import { FALAS } from './falas.mjs';
import { FPS } from './tema';

/** Um pedaço de uma gravação (segundos do arquivo). */
export interface Trecho {
  de: number;
  ate: number;
}

/** Gravação usada numa cena: arquivo em public/ e os trechos, na ordem. */
export interface Tomada {
  arquivo: string;
  trechos: Trecho[];
}

export enum TipoCena {
  Abertura = 'abertura',
  Tela = 'tela',
  Encerramento = 'encerramento',
}

export interface Cena {
  id: keyof typeof FALAS;
  tipo: TipoCena;
  /** Título no canto superior das cenas de tela. */
  titulo?: string;
  desktop?: Tomada;
  celular?: Tomada;
  /** Segundos a mais depois da fala (animações de abertura e encerramento pedem tempo). */
  folgaExtra?: number;
}

export const PRODUTO = {
  nome: 'Nome do produto',
  subtitulo: 'O que ele faz, numa frase curta',
  endereco: 'app.exemplo.com.br',
  /** Logo em public/ (PNG transparente ou SVG); vazio para não usar. */
  logo: 'logo.png',
};

const D = 'gravacoes/desktop.mp4';
const C = 'gravacoes/celular.mp4';

export const CENAS: Cena[] = [
  { id: 'abertura', tipo: TipoCena.Abertura, folgaExtra: 0.6 },
  { id: 'entrar', tipo: TipoCena.Tela, titulo: 'Criar a conta', desktop: { arquivo: D, trechos: [{ de: 2, ate: 12 }] }, celular: { arquivo: C, trechos: [{ de: 2, ate: 12 }] } },
  { id: 'usar', tipo: TipoCena.Tela, titulo: 'Tela principal', desktop: { arquivo: D, trechos: [{ de: 12, ate: 24 }] }, celular: { arquivo: C, trechos: [{ de: 12, ate: 24 }] } },
  { id: 'fim', tipo: TipoCena.Encerramento, folgaExtra: 2.4 },
];

const FOLGA_S = 1.1;
/** Atraso da fala no começo de cada cena (a imagem entra primeiro). */
export const ATRASO_FALA = Math.round(0.35 * FPS);
/** Quadros de sobreposição entre uma cena e a seguinte (esmaecimento). */
export const TRANSICAO = 12;

export const segundosDaFala = (c: Cena) => (indice as Record<string, { segundos: number }>)[c.id].segundos;
export const duracaoDaCena = (c: Cena) => Math.ceil((segundosDaFala(c) + FOLGA_S + (c.folgaExtra ?? 0)) * FPS) + ATRASO_FALA;
export const inicioDaCena = (i: number) => CENAS.slice(0, i).reduce((t, c) => t + duracaoDaCena(c) - TRANSICAO, 0);
export const DURACAO_TOTAL = inicioDaCena(CENAS.length - 1) + duracaoDaCena(CENAS[CENAS.length - 1]);

/**
 * Distribui a cena entre os trechos: a gravação corre na velocidade que cabe (no máximo 2,5x;
 * acima disso o fim do trecho fica de fora). Nunca passa do fim marcado: pedir um quadro depois do
 * fim do arquivo trava o render. Se a cena é mais longa que a gravação, ela desacelera.
 */
export function planejar(trechos: Trecho[], frames: number) {
  const totalS = trechos.reduce((t, x) => t + (x.ate - x.de), 0);
  const ritmo = Math.min(2.5, (totalS * FPS) / Math.max(1, frames));
  let em = 0;
  return trechos.map((trecho) => {
    const inicio = em;
    const duracao = ((trecho.ate - trecho.de) * FPS) / ritmo;
    em += duracao;
    return { trecho, inicio: Math.round(inicio), duracao: Math.round(duracao), ritmo };
  });
}

/** Legenda: frases da fala, cada uma na tela pelo tempo proporcional ao tamanho. */
export function frasesDaFala(c: Cena) {
  const texto = FALAS[c.id];
  // Corta só onde a frase seguinte começa com maiúscula ("Gaiolas! é" fica junto).
  const frases = texto.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/);
  const total = frases.reduce((t, f) => t + f.length, 0);
  const s = segundosDaFala(c);
  let em = 0;
  return frases.map((f) => {
    const de = em;
    em += (f.length / total) * s;
    return { texto: f, de: Math.round(de * FPS) + ATRASO_FALA, ate: Math.round(em * FPS) + ATRASO_FALA };
  });
}
