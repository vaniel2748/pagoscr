import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts', 'mcp/cli': 'src/mcp/cli.ts' },
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  dts: true,
  sourcemap: true,
  clean: true,
});
