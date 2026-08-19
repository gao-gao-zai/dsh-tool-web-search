import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/invariant.ts', 'src/client.ts'],
  outDir: 'lib',
  format: ['esm'],
  dts: false,
  sourcemap: true,
  clean: true,
})
