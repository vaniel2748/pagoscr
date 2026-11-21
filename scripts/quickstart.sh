#!/usr/bin/env bash
set -euo pipefail

pagoscr_root="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$pagoscr_root"

if ! command -v node >/dev/null 2>&1; then
  printf 'Instala Node.js 22.12 o superior y vuelve a ejecutar este comando.\n' >&2
  exit 1
fi
node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 22 || (major === 22 && minor < 12)) { console.error("PagosCR requiere Node.js 22.12 o superior."); process.exit(1); }'
pagoscr_started=$(node -e 'process.stdout.write(String(Date.now()))')

case "${1:-}" in
  '')
    npm ci --ignore-scripts
    npm run build --silent
    ;;
  --check)
    if [[ ! -f dist/mcp/cli.js ]]; then
      printf 'Primero ejecuta npm run build.\n' >&2
      exit 1
    fi
    ;;
  *)
    printf 'Uso: ./scripts/quickstart.sh [--check]\n' >&2
    exit 1
    ;;
esac

node scripts/quickstart.mjs
pagoscr_elapsed=$(node -e 'process.stdout.write(((Date.now() - Number(process.argv[1])) / 1000).toFixed(1))' "$pagoscr_started")
printf 'Inicio rápido completo: %s segundos.\n' "$pagoscr_elapsed"
