# CLAUDE.md

Client-side Nuxt 4 SPA that builds styled QR codes (URL, phone, email, SMS, text, Wi-Fi, contact) and exports PNG/SVG. No backend or database.

## Commands
- `npm run dev` — dev server (http://localhost:3000)
- `npm test` — Vitest unit/component tests
- `npm run test:e2e` — Playwright (decodes downloaded PNGs with jsqr; starts its own dev server on :3100)
- `npm run generate` — static build to `.output/public`
- `docker compose up --build` — nginx on `APP_PORT` (default 8080)

## Architecture
Logic lives in pure utils under `app/utils/` (`payload`, `validate`, `contrast`, `qrOptions`, `fields`); components are thin. Rendering is our own: `app/utils/qr/` (`matrix` → `renderSvg` → `rasterize`/`scanCheck`); every shape is an SVG symbol and uploaded SVGs go through `sanitizeSvg` first. To add a bundled shape edit `app/utils/qr/shapes.ts` and the selects in `StylePanel`. Form fields are data-driven from `FIELD_DEFS` in `app/utils/fields.ts` — to add a content type, extend `ContentType`/`QrInput`, `buildPayload`, `validateInput`, `TYPES` and `FIELD_DEFS`.

## Config
`NUXT_ADD_DEBUG_LOGS=true` enables `console.debug` traces (baked in at build time). Design: the Stitch project id is in `docs/design.md`.

## Gotchas
- `npm install` here skips package install scripts, so `postinstall` (`nuxt prepare`) may not run; run `npx nuxt prepare` once after a fresh install.
- `nuxt typecheck` currently fails (vue-tsc incompatible with the installed TypeScript); rely on `npm test`, `npm run generate` and `npm run test:e2e`.
- In Playwright, `getByLabel('URL')` also matches the tabpanel (it is `aria-labelledby` its tab); use `getByRole('textbox', { name, exact: true })`.

## Conventions
Branch off `main`, Pull Request only. Commit prefixes: feat/bugfix/secfix/refactor/config/docs.
