import type { AnimClip } from '../../../render/rig/types';
import { attacks } from './attacks';
import { movement } from './movement';

export const clips: Record<string, AnimClip> = { ...movement, ...attacks };
