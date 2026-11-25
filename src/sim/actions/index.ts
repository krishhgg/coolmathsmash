import { AIR } from './air';
import { ATTACK } from './attack';
import { DEFENSE } from './defense';
import { GRAB_ACTIONS } from './grab';
import { GROUND } from './ground';
import { HITSTUN } from './hitstun';
import { KNOCKDOWN } from './knockdown';
import { LEDGE } from './ledge';
import { ACTIONS } from './registry';
import { STATUS } from './status';
import { TETHER_ACTIONS } from './tether';

Object.assign(
  ACTIONS,
  GROUND,
  AIR,
  DEFENSE,
  LEDGE,
  STATUS,
  ATTACK,
  HITSTUN,
  KNOCKDOWN,
  GRAB_ACTIONS,
  TETHER_ACTIONS,
);

export { ACTIONS };
