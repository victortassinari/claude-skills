// Identidade visual do vídeo: copie as cores e a fonte do produto (tokens do tema do app ou do
// DESIGN.md da marca); nunca invente.
import { loadFont } from '@remotion/google-fonts/Roboto';

export const { fontFamily: FONTE } = loadFont('normal', { weights: ['400', '500', '700', '900'], subsets: ['latin', 'latin-ext'] });

export const FPS = 30;

export const COR = {
  fundo: '#ECEDED',
  superficie: '#FFFFFF',
  texto: '#333333',
  textoSuave: '#58585A',
  primaria: '#38A962',
  primariaEscura: '#007C30',
  destaque: '#F29400',
  /** Moldura do celular e fundo da legenda. */
  escuro: '#1F2A22',
};
