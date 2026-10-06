# Configuration

| Variable | Default | Where | Purpose |
|---|---|---|---|
| `NUXT_ADD_DEBUG_LOGS` | `false` | `.env`, Docker build arg | `true` prints trace logs (`[qr-code-builder] ...`) to the browser console. Read at build time for the static build; rebuild after changing. |
| `APP_PORT` | `8080` | `.env`, docker compose | Host port the container is published on. |

Copy `.env.example` to `.env` and adjust.
