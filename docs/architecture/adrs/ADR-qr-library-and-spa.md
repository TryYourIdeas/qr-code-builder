# ADR: qr-code-styling in a client-only SPA

**Status:** partially superseded by `ADR-own-svg-renderer.md` (rendering library); SPA decision accepted — 2026-10-06

**Context:** The app must render styled QR codes (shapes, colors, logo) and export PNG/SVG. No data needs to be stored or sent anywhere.

**Decision:** Use `qr-code-styling` loaded dynamically in the browser; run Nuxt with `ssr: false` and ship the static build behind nginx.

**Alternatives:** `qrcode` (no styling support, would need custom canvas work); custom SVG renderer on `qrcode-generator` (full control but most code and tests).

**Consequences:** No server, trivial deployment, user content never leaves the browser. Styling is limited to what the library supports. No SSR/SEO of generated content (not needed).
