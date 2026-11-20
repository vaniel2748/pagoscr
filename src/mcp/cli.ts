#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createPagosCrServer } from './server.js';

try {
  await createPagosCrServer().connect(new StdioServerTransport());
} catch {
  console.error(
    'No se pudo iniciar PagosCR. Revisa Node.js y las dependencias; no se muestran secretos.',
  );
  process.exitCode = 1;
}
