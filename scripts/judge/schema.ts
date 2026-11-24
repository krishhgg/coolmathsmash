import { AXES, type Axis } from './rubric.ts';

/** A JSON Schema (draft 2020-12 subset) object. */
export type Schema = {
  type?: string | string[];
  const?: unknown;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  minItems?: number;
  maxItems?: number;
  items?: Schema;
  required?: string[];
  properties?: Record<string, Schema>;
  additionalProperties?: boolean;
  [key: string]: unknown;
};

export interface JudgeVerdict {
  judge: string;
  round: number;
  states: Record<string, { scores: Record<string, number | null>; notes: string }>;
  gaps: { rank: number; state: string; axis: string; gap: string; evidence: string; fix: string }[];
  regressions: string[];
}

/** The strict schema a judge's answer must match for this round's states. */
export function judgeSchema(
  round: number,
  states: { name: string; motion: boolean }[],
  axes: readonly Axis[] = AXES,
): Schema {
  const text: Schema = { type: 'string', minLength: 1 };
  const score = (applies: boolean): Schema =>
    applies ? { type: ['integer', 'null'], minimum: 1, maximum: 10 } : { type: 'null' };
  const state = (motion: boolean): Schema => ({
    type: 'object',
    additionalProperties: false,
    required: ['scores', 'notes'],
    properties: {
      scores: {
        type: 'object',
        additionalProperties: false,
        required: axes.map((a) => a.id),
        properties: Object.fromEntries(axes.map((a) => [a.id, score(a.id !== 'physics_feel' || motion)])),
      },
      notes: text,
    },
  });
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: `Coolmath Smash judge verdict, round ${round}`,
    type: 'object',
    additionalProperties: false,
    required: ['judge', 'round', 'states', 'gaps', 'regressions'],
    properties: {
      judge: text,
      round: { type: 'integer', const: round },
      states: {
        type: 'object',
        additionalProperties: false,
        required: states.map((s) => s.name),
        properties: Object.fromEntries(states.map((s) => [s.name, state(s.motion)])),
      },
      gaps: {
        type: 'array',
        minItems: 3,
        maxItems: 15,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['rank', 'state', 'axis', 'gap', 'evidence', 'fix'],
          properties: {
            rank: { type: 'integer', minimum: 1 },
            state: { type: 'string', enum: [...states.map((s) => s.name), '*'] },
            axis: { type: 'string', enum: axes.map((a) => a.id) },
            gap: text,
            evidence: text,
            fix: text,
          },
        },
      },
      regressions: { type: 'array', items: text },
    },
  };
}

function typeOf(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}

/** Validate `value` against the schema subset judgeSchema uses; returns one message per problem. */
export function validate(schema: Schema, value: unknown, path = '$'): string[] {
  const t = typeOf(value);
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.includes(t) && !(t === 'integer' && types.includes('number'))) {
      return [`${path}: expected ${types.join(' or ')}, got ${t}`];
    }
  }
  const errors: string[] = [];
  if ('const' in schema && value !== schema.const)
    errors.push(`${path}: must be ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path}: must be one of ${schema.enum.map((e) => JSON.stringify(e)).join(', ')}`);
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum)
      errors.push(`${path}: below ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum)
      errors.push(`${path}: above ${schema.maximum}`);
  }
  if (typeof value === 'string' && schema.minLength !== undefined && value.trim().length < schema.minLength) {
    errors.push(`${path}: must not be empty`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems)
      errors.push(`${path}: needs at least ${schema.minItems} items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems)
      errors.push(`${path}: at most ${schema.maxItems} items`);
    if (schema.items)
      value.forEach((item, i) => errors.push(...validate(schema.items!, item, `${path}[${i}]`)));
  }
  if (t === 'object') {
    const obj = value as Record<string, unknown>;
    for (const key of schema.required ?? []) if (!(key in obj)) errors.push(`${path}.${key}: missing`);
    for (const [key, v] of Object.entries(obj)) {
      const sub = schema.properties?.[key];
      if (sub) errors.push(...validate(sub, v, `${path}.${key}`));
      else if (schema.additionalProperties === false) errors.push(`${path}.${key}: not allowed`);
    }
  }
  return errors;
}
