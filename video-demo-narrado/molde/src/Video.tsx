import React from 'react';
import { AbsoluteFill, Audio, Img, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { ATRASO_FALA, type Cena, CENAS, duracaoDaCena, frasesDaFala, inicioDaCena, planejar, PRODUTO, TipoCena, type Tomada, TRANSICAO } from './roteiro';
import { COR, FONTE, FPS } from './tema';

export enum Formato {
  Horizontal = 'horizontal',
  Vertical = 'vertical',
}

/** Volume da narração no Remotion; o nível final (-16 LUFS) é acertado em scripts/finalizar.mjs. */
const VOLUME_FALA = 1;
const SAIDA = (t: number) => 1 - Math.pow(1 - t, 4);
const entre = (f: number, de: number, ate: number) => interpolate(f, [de, ate], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: SAIDA });

export const VideoDemo: React.FC<{ formato: Formato }> = ({ formato }) => {
  const vertical = formato === Formato.Vertical;
  return (
    <AbsoluteFill style={{ background: COR.fundo, fontFamily: FONTE, color: COR.texto }}>
      {CENAS.map((c, i) => (
        <Sequence key={c.id} from={inicioDaCena(i)} durationInFrames={duracaoDaCena(c)} name={c.id}>
          <Esmaecer duracao={duracaoDaCena(c)} primeira={i === 0} ultima={i === CENAS.length - 1}>
            {c.tipo === TipoCena.Abertura ? (
              <Abertura vertical={vertical} />
            ) : c.tipo === TipoCena.Encerramento ? (
              <Encerramento vertical={vertical} />
            ) : (
              <CenaDeTela cena={c} vertical={vertical} />
            )}
            <Legenda cena={c} vertical={vertical} />
          </Esmaecer>
          <Sequence from={ATRASO_FALA} layout="none">
            <Audio src={staticFile(`narracao/${c.id}.mp3`)} volume={VOLUME_FALA} />
          </Sequence>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

const Esmaecer: React.FC<{ duracao: number; primeira: boolean; ultima: boolean; children: React.ReactNode }> = ({ duracao, primeira, ultima, children }) => {
  const f = useCurrentFrame();
  const entrada = primeira ? 1 : interpolate(f, [0, TRANSICAO], [0, 1], { extrapolateRight: 'clamp' });
  const saida = ultima ? interpolate(f, [duracao - 20, duracao], [1, 0], { extrapolateLeft: 'clamp' }) : 1;
  return <AbsoluteFill style={{ opacity: Math.min(entrada, saida) }}>{children}</AbsoluteFill>;
};

// ------------------------------------------------------------------ abertura e encerramento

/** Texto que entra letra por letra, subindo de trás de uma máscara. */
const Letras: React.FC<{ texto: string; atraso: number }> = ({ texto, atraso }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <span style={{ display: 'block', overflow: 'hidden', paddingBottom: '0.06em' }}>
      {[...texto].map((c, i) => {
        const k = spring({ frame: f - atraso - i * 1.4, fps, config: { damping: 200 }, durationInFrames: 22 });
        return (
          <span key={i} style={{ display: 'inline-block', whiteSpace: 'pre', transform: `translateY(${(1 - k) * 105}%)`, opacity: Math.min(1, k * 1.6) }}>
            {c}
          </span>
        );
      })}
    </span>
  );
};

const Marca: React.FC<{ tamanho: number }> = ({ tamanho }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame: f - 2, fps, config: { damping: 200 }, durationInFrames: 26 });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: tamanho * 0.3 }}>
      {PRODUTO.logo && (
        <Img src={staticFile(PRODUTO.logo)} style={{ height: tamanho * 1.6, opacity: logo, transform: `scale(${0.85 + logo * 0.15})` }} />
      )}
      <div style={{ fontWeight: 900, fontSize: tamanho, lineHeight: 0.95, letterSpacing: '-0.02em', color: COR.primariaEscura }}>
        <Letras texto={PRODUTO.nome} atraso={6} />
      </div>
    </div>
  );
};

const Abertura: React.FC<{ vertical: boolean }> = ({ vertical }) => {
  const sub = entre(useCurrentFrame(), 34, 54);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 36, padding: 80, paddingBottom: vertical ? 420 : 200 }}>
      <Marca tamanho={vertical ? 96 : 120} />
      <p style={{ margin: 0, fontSize: vertical ? 46 : 44, color: COR.textoSuave, textAlign: 'center', maxWidth: vertical ? 860 : 1200, opacity: sub, transform: `translateY(${(1 - sub) * 16}px)` }}>
        {PRODUTO.subtitulo}
      </p>
    </AbsoluteFill>
  );
};

const Encerramento: React.FC<{ vertical: boolean }> = ({ vertical }) => {
  const end = entre(useCurrentFrame(), 30, 52);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 48, padding: 80, paddingBottom: vertical ? 420 : 200 }}>
      <Marca tamanho={vertical ? 88 : 108} />
      <div
        style={{
          // O endereço se revela do centro para fora.
          clipPath: `inset(0 ${(1 - end) * 50}% 0 ${(1 - end) * 50}% round 999px)`,
          background: COR.primariaEscura,
          color: '#fff',
          fontWeight: 700,
          fontSize: vertical ? 44 : 56,
          padding: vertical ? '24px 36px' : '26px 52px',
          borderRadius: 999,
        }}
      >
        {PRODUTO.endereco}
      </div>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ cenas de tela

/**
 * Horizontal: computador numa moldura de navegador e celular ao lado (ou só o computador, maior).
 * Vertical: o celular em destaque; sem gravação de celular, o computador ocupa a largura.
 */
const CenaDeTela: React.FC<{ cena: Cena; vertical: boolean }> = ({ cena, vertical }) => {
  const frames = duracaoDaCena(cena);
  const { desktop, celular } = cena;
  return (
    <AbsoluteFill>
      <Titulo texto={cena.titulo ?? ''} vertical={vertical} />
      {vertical ? (
        celular ? (
          <Celular x={158} y={250} altura={1260} tomada={celular} frames={frames} />
        ) : (
          desktop && <Navegador x={40} y={560} largura={1000} tomada={desktop} frames={frames} />
        )
      ) : celular && desktop ? (
        <>
          <Navegador x={80} y={170} largura={1300} tomada={desktop} frames={frames} />
          <Celular x={1418} y={150} altura={770} tomada={celular} frames={frames} atraso={6} />
        </>
      ) : desktop ? (
        <Navegador x={(1920 - 1440) / 2} y={150} largura={1440} tomada={desktop} frames={frames} />
      ) : (
        celular && <Celular x={(1920 - 560) / 2} y={140} altura={860} tomada={celular} frames={frames} />
      )}
    </AbsoluteFill>
  );
};

const Titulo: React.FC<{ texto: string; vertical: boolean }> = ({ texto, vertical }) => {
  const t = entre(useCurrentFrame(), 4, 22);
  return (
    <div style={{ position: 'absolute', left: vertical ? 60 : 80, top: vertical ? 100 : 56, display: 'flex', alignItems: 'center', gap: 20 }}>
      {PRODUTO.logo && <Img src={staticFile(PRODUTO.logo)} style={{ height: vertical ? 80 : 64 }} />}
      <span style={{ fontSize: vertical ? 60 : 50, fontWeight: 900, color: COR.primariaEscura, opacity: t, transform: `translateX(${(1 - t) * -24}px)` }}>{texto}</span>
    </div>
  );
};

const useEntrada = (atraso: number) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - atraso, fps, config: { damping: 200 }, durationInFrames: 22 });
};

const Navegador: React.FC<{ x: number; y: number; largura: number; tomada: Tomada; frames: number }> = ({ x, y, largura, tomada, frames }) => {
  const e = useEntrada(0);
  const altura = (largura * 9) / 16;
  const barra = Math.round(largura * 0.032);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: largura,
        borderRadius: 18,
        overflow: 'hidden',
        background: COR.superficie,
        boxShadow: '0 30px 70px rgba(0,0,0,.16), 0 0 0 1px rgba(0,0,0,.08)',
        opacity: e,
        transform: `translateY(${(1 - e) * 40}px)`,
      }}
    >
      <div style={{ height: barra, display: 'flex', alignItems: 'center', gap: barra * 0.28, padding: `0 ${barra * 0.6}px`, background: '#F2F2F2' }}>
        {['#E5534B', '#F2B200', '#38A962'].map((c) => (
          <span key={c} style={{ width: barra * 0.32, height: barra * 0.32, borderRadius: 99, background: c }} />
        ))}
        <span style={{ marginLeft: barra * 0.5, flex: 1, maxWidth: largura * 0.42, height: barra * 0.6, borderRadius: 99, background: '#fff', fontSize: barra * 0.36, color: COR.textoSuave, display: 'flex', alignItems: 'center', paddingLeft: barra * 0.4 }}>
          {PRODUTO.endereco}
        </span>
      </div>
      <Trechos tomada={tomada} frames={frames} largura={largura} altura={altura} />
    </div>
  );
};

/** Proporção da gravação do celular (390x664 CSS em densidade 2 = 780x1328). */
const PROPORCAO_CELULAR = 780 / 1328;

const Celular: React.FC<{ x: number; y: number; altura: number; tomada: Tomada; frames: number; atraso?: number }> = ({ x, y, altura, tomada, frames, atraso = 0 }) => {
  const e = useEntrada(atraso);
  const borda = Math.round(altura * 0.022);
  const tela = altura - borda * 2;
  const largura = Math.round(tela * PROPORCAO_CELULAR);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        padding: borda,
        borderRadius: borda * 3.6,
        background: COR.escuro,
        boxShadow: '0 30px 70px rgba(0,0,0,.28)',
        opacity: e,
        transform: `translateY(${(1 - e) * 50}px)`,
      }}
    >
      <div style={{ borderRadius: borda * 2.6, overflow: 'hidden', width: largura, height: tela, background: COR.fundo }}>
        <Trechos tomada={tomada} frames={frames} largura={largura} altura={tela} />
      </div>
    </div>
  );
};

const Trechos: React.FC<{ tomada: Tomada; frames: number; largura: number; altura: number }> = ({ tomada, frames, largura, altura }) => (
  <div style={{ position: 'relative', width: largura, height: altura, background: COR.fundo }}>
    {planejar(tomada.trechos, frames).map(({ trecho, inicio, duracao, ritmo }, i) => (
      <Sequence key={i} from={inicio} durationInFrames={duracao} layout="none">
        <OffthreadVideo
          src={staticFile(tomada.arquivo)}
          muted
          trimBefore={Math.round(trecho.de * FPS)}
          playbackRate={ritmo}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </Sequence>
    ))}
  </div>
);

// ------------------------------------------------------------------ legenda

const Legenda: React.FC<{ cena: Cena; vertical: boolean }> = ({ cena, vertical }) => {
  const f = useCurrentFrame();
  const frases = frasesDaFala(cena);
  const atual = frases.find((x, i) => f >= x.de && (f < x.ate || i === frases.length - 1));
  if (!atual || f < atual.de) return null;
  const o = interpolate(f, [atual.de, atual.de + 6], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', left: '50%', bottom: vertical ? 150 : 44, transform: 'translateX(-50%)', width: vertical ? 960 : 1500, display: 'flex', justifyContent: 'center', textAlign: 'center' }}>
      <span
        style={{
          opacity: o,
          background: 'rgba(31,42,34,.86)',
          color: '#fff',
          fontSize: vertical ? 44 : 36,
          fontWeight: 500,
          lineHeight: 1.32,
          padding: vertical ? '16px 26px' : '12px 26px',
          borderRadius: 16,
          textWrap: 'balance',
        }}
      >
        {atual.texto}
      </span>
    </div>
  );
};
