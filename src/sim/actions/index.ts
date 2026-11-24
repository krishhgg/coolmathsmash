import { AIR } from './air';
import { ATTACK } from './attack';
import { DEFENSE } from './defense';
import { GROUND } from './ground';
import { HITSTUN } from './hitstun';
import { LEDGE } from './ledge';
import { ACTIONS } from './registry';
import { STATUS } from './status';

Object.assign(ACTIONS, GROUND, AIR, DEFENSE, LEDGE, STATUS, ATTACK, HITSTUN);

export { ACTIONS };
