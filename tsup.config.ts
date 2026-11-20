import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'mcp/cli': 'src/mcp/cli.ts',
    'template/cli': 'template/cli.ts',
  },
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  noExternal: [/.*/],
  metafile: true,
  banner: {
    js: "import { createRequire as __pagoscrCreateRequire } from 'node:module'; const require = __pagoscrCreateRequire(import.meta.url);",
  },
  dts: true,
  sourcemap: true,
  clean: true,
});
