# ADR: Own SVG renderer instead of qr-code-styling

**Status:** accepted — 2026-10-06 (supersedes `ADR-qr-library-and-spa.md` for the rendering library; the client-only SPA decision stands)

**Context:** Users want to upload an SVG for the corner "eyes" (rotated 0°, -90°, +90°) and optionally for the data dots. `qr-code-styling` only offers fixed shape presets and no way to supply custom SVG shapes.

**Decision:** Render the code ourselves. `qrcode-generator` provides the module matrix (UTF-8 encoder); a pure `renderSvg` function draws every shape as an SVG `<symbol>` placed with `<use>`. The SVG string is the preview and the SVG download; PNG is that SVG rasterized on a canvas. Uploaded SVGs are sanitized (scripts, handlers, external references removed; ids prefixed) before being embedded. After each render the app decodes its own output with `jsQR` and warns if it cannot be read back.

**Alternatives:** Overlay custom eyes on the `qr-code-styling` output (keeps the library's dot styles but needs its internal layout math and a second pipeline); keep the library and offer more presets only (no custom SVG).

**Consequences:** One pipeline, preview and exports always match, custom shapes are first-class. The library's `classy`, `classy-rounded`, `extra-rounded` dot styles and gradients are dropped (see backlog). We own the logic for module layout, logo clearing and sanitizing, all covered by unit and e2e tests. `jsqr` becomes a runtime dependency (about 40 KB). The scan check already paid off: it flagged that circular dots with a 0.45 radius did not decode, which led to touching circles (radius 0.5).
