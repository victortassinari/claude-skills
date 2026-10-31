import React from 'react';
import { Composition } from 'remotion';
import { DURACAO_TOTAL } from './roteiro';
import { FPS } from './tema';
import { Formato, VideoDemo } from './Video';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Horizontal" component={VideoDemo} defaultProps={{ formato: Formato.Horizontal }} durationInFrames={DURACAO_TOTAL} fps={FPS} width={1920} height={1080} />
    <Composition id="Vertical" component={VideoDemo} defaultProps={{ formato: Formato.Vertical }} durationInFrames={DURACAO_TOTAL} fps={FPS} width={1080} height={1920} />
  </>
);
