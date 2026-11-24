import type { Palette } from '../../../render/rig/types';

/**
 * Costumes. `default` is Red Ball's own red; the alternates are the other balls of the Red Ball 4 cutscenes and
 * fan favourites, plus `evil`, an Evil Box nod: charcoal with orange eyes. Every symbol reads only these keys.
 */
const ball = (c: {
  line: string;
  body: string;
  bodyHi: string;
  bodyLo: string;
  eyeWhite?: string;
  eyeLine?: string;
  pupil?: string;
  mouthIn?: string;
  tongue?: string;
  tongueHi?: string;
  tongueLo?: string;
}): Palette => ({
  line: c.line,
  body: c.body,
  bodyHi: c.bodyHi,
  bodyLo: c.bodyLo,
  shine: '#ffffff',
  eyeWhite: c.eyeWhite ?? '#ffffff',
  eyeLine: c.eyeLine ?? c.line,
  pupil: c.pupil ?? '#141414',
  mouthIn: c.mouthIn ?? '#5a0e16',
  teeth: '#ffffff',
  tongue: c.tongue ?? '#ff8fa8',
  tongueHi: c.tongueHi ?? '#ffc4d2',
  tongueLo: c.tongueLo ?? '#d9506f',
  dust: '#ece6da',
  dustLine: '#9b9183',
  speed: '#ffffff',
  star: '#ffd83a',
  sweat: '#a8dcff',
});

export const palettes: { default: Palette } & Record<string, Palette> = {
  default: ball({ line: '#3d0b10', body: '#e7323a', bodyHi: '#ff7d78', bodyLo: '#b01a27' }),
  blue: ball({ line: '#0b2147', body: '#2f7fe6', bodyHi: '#7cc0ff', bodyLo: '#1b4fa8', mouthIn: '#10204a' }),
  green: ball({ line: '#0f3312', body: '#3dbb3a', bodyHi: '#94ec7a', bodyLo: '#21811f', mouthIn: '#173a12' }),
  yellow: ball({
    line: '#4a2f05',
    body: '#f6c21c',
    bodyHi: '#ffe98a',
    bodyLo: '#cf8c0b',
    mouthIn: '#5a2a08',
  }),
  pink: ball({ line: '#4a0b35', body: '#ec5fb4', bodyHi: '#ffaedd', bodyLo: '#b8337f', mouthIn: '#4f0e33' }),
  purple: ball({
    line: '#25104a',
    body: '#8a4fd8',
    bodyHi: '#c6a0ff',
    bodyLo: '#5d2aa6',
    mouthIn: '#2a1050',
  }),
  evil: ball({
    line: '#0b0b0d',
    body: '#3b3c41',
    bodyHi: '#696b73',
    bodyLo: '#232428',
    eyeWhite: '#f59a1b',
    eyeLine: '#0b0b0d',
    pupil: '#0b0b0d',
    mouthIn: '#141416',
    tongue: '#e0574f',
    tongueHi: '#ff9a8a',
    tongueLo: '#9e2b29',
  }),
};
