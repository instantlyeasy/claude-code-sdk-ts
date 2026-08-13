import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/v1/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: false,
  clean: true,
  splitting: false,
  shims: true
});