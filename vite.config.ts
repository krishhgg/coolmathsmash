/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 2000 },
  server: { port: 5173 },
  preview: { port: 4173 },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
});
