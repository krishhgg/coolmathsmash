import { AIR } from './air';
import { DEFENSE } from './defense';
import { GROUND } from './ground';
import { LEDGE } from './ledge';
import { ACTIONS } from './registry';
import { STATUS } from './status';

Object.assign(ACTIONS, GROUND, AIR, DEFENSE, LEDGE, STATUS);

export { ACTIONS };
