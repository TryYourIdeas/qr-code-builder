# QR Code Builder — Design

Date: 2026-10-06

## Purpose

A standalone Nuxt app where a user enters content (URL, phone number, and other types), customizes the look of the QR code, previews it live, and downloads it as an image. It is intended as a base to grow into a branded QR generator. Everything runs in the browser: no accounts, no database, no server API.

## Scope

In scope:
- Content types: URL, Phone, Email, SMS, Plain text, Wi-Fi, vCard contact.
- Branded styling: foreground/background colors, dot style, corner style, center logo upload, size, error-correction level.
- Export: PNG and SVG download.
- Input validation and a low-contrast warning.

Out of scope (recorded in `docs/backlog.md` / `docs/future-work.md`):
- Tracked/dynamic codes (short redirect links, scan counts).
- Saved library of codes per user (SSO via `iam`, Postgres/Drizzle).

## Assumptions

- A phone number is encoded as `tel:<number>`.
- Generation is client-side only; the Nuxt app runs in SPA mode (`ssr: false`).
- Logos are read in the browser and never uploaded.

## Approach

Use `qr-code-styling` for rendering and export (dot/corner shapes, colors, logo, PNG/SVG). Alternatives considered: `qrcode` (no styling) and a custom SVG renderer on `qrcode-generator` (most code, only justified by unsupported styles). Recorded as an ADR.

## Architecture

Stack: Nuxt 4, Vue 3, TypeScript, Tailwind, Vitest, Testing Library, Playwright.

```
app/
  pages/index.vue            single page: form + live preview
  components/
    ContentTypeTabs.vue
    ContentForm.vue          one data-driven form, fields defined in utils/fields.ts
    StylePanel.vue
    QrPreview.vue            client-only wrapper around qr-code-styling
    DownloadButtons.vue
  utils/payload.ts           buildPayload(type, fields) -> string (pure)
  utils/validate.ts          validators (pure)
  utils/fields.ts            content types and per-type field definitions
  composables/useQrStyle.ts  style state, contrast check, qr-code-styling instance
```

### Payload formats
`buildPayload` is a pure function with no UI dependency:
- URL: as entered (scheme added if missing)
- Phone: `tel:+...`
- Email: `mailto:addr?subject=&body=`
- SMS: `SMSTO:number:message`
- Text: raw
- Wi-Fi: `WIFI:T:<WPA|WEP|nopass>;S:<ssid>;P:<pass>;H:<hidden>;;` with `\ ; , : "` escaped
- vCard: `BEGIN:VCARD` v3.0 with escaped values

### Styling
Foreground/background color, dot style, corner style, logo (PNG/JPG/SVG), size, error-correction level. Error correction is forced to H when a logo is present. A contrast check warns when foreground/background contrast is too low to scan reliably.

### Export
PNG and SVG via the `qr-code-styling` download API.

### Validation and accessibility
Inline validation (URL, phone, email, required fields); errors announced via `aria-live`; labeled inputs; keyboard-operable tabs.

### Logging
Trace logging for the generate/export flow gated by `NUXT_ADD_DEBUG_LOGS`; errors (invalid logo file, export failure) always logged to the console with the relevant context.

## Testing

- Vitest: `buildPayload` (including escaping), validators, contrast check.
- Testing Library: component tests including accessibility (labels, roles, aria-live).
- Playwright: enter a URL, see the preview, download a PNG, decode it and confirm it matches the input. Same for a phone number.

## Delivery

- Docker: multi-stage build, static output served by nginx; `docker-compose.yml`; configuration from `.env` (`.env.example` committed).
- UI design generated with the Stitch MCP; project id stored in project memory.
- Docs: `docs/index`, `docs/user-guides/{config,manual,features}.md`, `docs/backlog.md`, `docs/future-work.md`, `docs/changes.md`, ADR for the library/SPA decision, project `CLAUDE.md`, and a row in `web/docs/modules.md`.
- Git: work on `feat/qr-code-builder`; lands on `main` only via a reviewed Pull Request. Commit prefixes follow the user's standard (`feat:`, `docs:`, `config:`, ...).
