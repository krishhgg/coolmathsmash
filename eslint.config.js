import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

const SEEDED_RNG = {
  object: 'Math',
  property: 'random',
  message: 'Use the seeded RNG so the simulation stays deterministic.',
};

/**
 * Math functions the spec lets engines approximate. Node and Chromium round several of them differently in the last
 * bit, so a match drifts apart between them. src/sim/math.ts has the ones the simulation needs.
 */
const ENGINE_MATH = [
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'atan2',
  'sinh',
  'cosh',
  'tanh',
  'asinh',
  'acosh',
  'atanh',
  'exp',
  'expm1',
  'log',
  'log1p',
  'log2',
  'log10',
  'pow',
  'cbrt',
  'hypot',
];

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'test-results', 'playwright-report', 'captures', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: { allowDefaultProject: ['eslint.config.js'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-restricted-properties': ['error', SEEDED_RNG],
    },
  },
  {
    // Code that feeds the simulation's state. Art, stage views and tests stay on plain Math.
    files: ['src/sim/**/*.ts', 'src/fighters/**/*.ts', 'src/stages/**/*.ts', 'src/ai/**/*.ts'],
    ignores: ['**/art/**', 'src/stages/*/view.ts', '**/*.test.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        SEEDED_RNG,
        ...ENGINE_MATH.map((property) => ({
          object: 'Math',
          property,
          message: `Engines round Math.${property} differently. Use src/sim/math.ts so every runtime plays the same match.`,
        })),
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "BinaryExpression[operator='**'][right.value!=2], AssignmentExpression[operator='**=']",
          message:
            'Engines round ** differently for exponents other than 2. Multiply, or use src/sim/math.ts.',
        },
      ],
    },
  },
  { files: ['eslint.config.js'], ...tseslint.configs.disableTypeChecked },
  prettier,
);
