# Agent guide

Coolmath Smash is a browser platform fighter (TypeScript, Vite, PixiJS 8). Read this before changing anything.

## Commands

- `npm ci` installs dependencies; `npx playwright install chromium` once for e2e.
- `npm run dev` starts the dev server on :5173.
- `npm run check` runs lint, format check, typecheck, unit tests and build (what CI runs).
- `npm run e2e` runs the Playwright suite against `vite preview` (run `npm run build` first). Set `PW_PORT` (default 4173) to run it beside another checkout.
- `npm run format` fixes formatting.

## Rules

- The simulation must stay deterministic: no `Math.random`, no wall-clock time, no iteration over unordered sources inside `src/sim`.
- Ship every change as a small PR with screenshots or GIFs in the body.
