# Own SVG Renderer with Custom Eye and Dot Shapes — Design

Date: 2026-10-06
Extends: `2026-10-06-qr-code-builder-design.md`. Supersedes the library choice in `docs/architecture/adrs/ADR-qr-library-and-spa.md`.

## Purpose

Let the user upload an SVG that becomes the three corner "eyes" of the QR code, and optionally an SVG used as the shape of every data dot. To do this cleanly, replace `qr-code-styling` with an own renderer in which every shape is an SVG. Everything remains client-side.

## Scope

In scope:
- Custom eye SVG (one SVG for the whole 7×7-module finder, outer frame and inner dot together), placed at three corners: top-left rotated 0°, top-right rotated -90°, bottom-left rotated +90°. There is no eye at bottom-right.
- Custom dot SVG used as the tile for every dark data module.
- Bundled shapes replace the library's presets: dots `square`, `dots`, `rounded`; eyes `square`, `rounded`, `dot`. They are plain SVG tiles handled by the same code path as uploads.
- Single pipeline: renderer outputs one SVG string that is the live preview and the SVG download; PNG is that SVG rasterized on a canvas.
- Sanitizing of uploaded SVGs, UTF-8 payload support, a scan check that decodes our own output.
- Existing features keep working: all seven content types, colors, size, error-correction level, center logo (forces level H), contrast warning, validation.

Out of scope (backlog):
- The library's `classy`, `classy-rounded` and `extra-rounded` dot styles and gradients.
- Separate outer-frame and inner-dot eye SVGs; a different eye for each corner.
- Custom SVG for alignment patterns (they use the dot tile).

## Decisions and assumptions

- Uploaded SVGs keep their own colors. The foreground color applies only to bundled shapes. Background color always applies.
- Uploaded SVGs stay in the browser and are never persisted.
- A failed scan check is a warning, not a block.
- The quiet zone is 4 modules (the QR standard), replacing the previous fixed 10 px margin.
- `qr-code-styling` is removed. `jsqr` moves from devDependencies to dependencies. `qrcode-generator` becomes a direct dependency.

## Architecture

Pure functions under `app/utils/qr/`, each independently testable; components stay thin.

```
app/utils/qr/
  matrix.ts        buildMatrix(text, level) -> { size, isDark(row, col) }   (qrcode-generator, UTF-8)
  shapes.ts        bundled dot tiles and eye shapes as SVG markup, in a unit box
  sanitizeSvg.ts   sanitizeSvg(markup) -> { ok: true, viewBox, inner } | { ok: false, error }
  renderSvg.ts     renderSvg(matrix, style) -> SVG string
  rasterize.ts     svgToPng(svg, px) -> Promise<Blob>  (canvas, browser only)
  scanCheck.ts     scansBack(svg) -> Promise<boolean>  (rasterize + jsQR)
app/utils/qrOptions.ts   StyleState gains dotShape, eyeShape, customDot, customEye; buildQrOptions removed
app/components/QrPreview.vue   renders the SVG as an <img>; exposes download('png' | 'svg')
app/components/StylePanel.vue  shape selectors + two SVG uploads
```

### Style state
```
dotShape: 'square' | 'dots' | 'rounded' | 'custom'
eyeShape: 'square' | 'rounded' | 'dot' | 'custom'
customDot: SanitizedSvg | null
customEye: SanitizedSvg | null
```
Existing fields (`fg`, `bg`, `size`, `errorLevel`, `logo`) stay. The old `dotStyle` and `cornerStyle` are replaced by `dotShape` and `eyeShape`. Choosing `custom` requires an uploaded SVG; removing it falls back to the previous bundled shape.

### Matrix
`qrcode-generator` with type number 0 (auto) and the chosen error-correction level (H when a logo is present). Its byte encoder is set to UTF-8 so emoji and accented text encode correctly. `make()` overflow throws; it is surfaced as a capacity error (same user-facing messages as today, including the "remove the logo" variant).

### Geometry (module units)
- `n` = matrix size, quiet zone `q = 4`, total `T = n + 2q`. SVG `viewBox="0 0 T T"`, `width`/`height` = `size` px. A background `<rect>` fills the viewBox with `bg`.
- Eye boxes are 7×7 at module origins `(0,0)`, `(n-7,0)`, `(0,n-7)`, offset by `q`. Rotation is about each box center `(x+3.5, y+3.5)`: top-left `0`, top-right `-90`, bottom-left `90`.
- Data modules inside the three 7×7 boxes are skipped (the eyes replace them). All other dark modules, including timing and alignment patterns, are drawn from the dot tile.
- Shapes are defined once in `<defs>` as `<symbol viewBox=...>` (`qrb-dot`, `qrb-eye`) and placed with `<use href=... x y width height>`: tiles at width/height 1, eyes at 7. An uploaded SVG is placed using its own `viewBox` mapped into that box.
- Logo: an `<image>` (data URL) centered, covering 25% of `n`; dark modules whose centers fall inside the logo box plus a 1-module pad are skipped, and the pad is filled with `bg`.

### Sanitizing uploaded SVGs
- Accept `image/svg+xml` only, up to 200 KB and 2,000 nodes; parse with `DOMParser`; reject parser errors and non-`<svg>` roots.
- Require a `viewBox` (or numeric `width`/`height`) with aspect ratio within ±5% of square.
- Remove `script`, `foreignObject`, `iframe`, `object`, `embed`, `audio`, `video`, `use` (reference chains expand exponentially), `animate*`, `set`, and every element or attribute outside the SVG/xlink/xml namespaces; custom dot tiles are capped at 200 elements; stylesheets containing a backslash or `@` are dropped and the rest are scoped to the upload (class names prefixed); strip whitespace/control characters before checking for `javascript:`; remove all `on*` attributes; keep `href`/`xlink:href` only when they start with `#` or `data:image/(png|jpeg|gif|webp)`; strip `@import` and non-local `url(...)` from `style` elements and attributes.
- Prefix every `id` (and rewrite `url(#...)` and `href="#..."` references) per upload (`eye-`, `dot-`) so gradients and clip paths cannot collide between the two uploads or with our own ids.
- Re-serialize with `XMLSerializer`. Only the sanitized output is ever embedded in the exported SVG, because standalone SVG files can execute scripts when opened directly.

### Preview and export
- Preview: the SVG string as an `<img src="data:image/svg+xml...">` with alt text; the same string is the SVG download (`qr-code.svg`).
- PNG (`qr-code.png`): load the SVG into an `Image`, draw it on a canvas of `size` px, `toBlob`. Data-URL logos keep the canvas untainted.
- Downloads stay disabled when the input is invalid or rendering failed.

### Scan check
After each render (debounced ~300 ms), rasterize at ~400 px, run `jsQR`, and compare the decoded text with the payload. A mismatch shows a `role="status"` warning ("This design may not scan reliably — a scanner could not read it back. Try a simpler or higher-contrast shape."). It never blocks download.

### Errors and logging
- Invalid upload (type, size, parse, aspect ratio, unsafe-only content): visible `role="alert"` message in the Style panel; previous shape stays active. Details logged with `console.error` (file name, size, reason).
- Capacity overflow, rasterize failure and decode failures are surfaced as today. Trace logs (render, sanitize result, scan check) are gated by `NUXT_ADD_DEBUG_LOGS`.

## Testing

- Vitest: `matrix` (UTF-8, overflow, size grows with data), `shapes`, `sanitizeSvg` (strips script/handlers/external refs, id prefixing, rejects non-square, oversized, malformed), `renderSvg` (three eyes with `rotate(0)`, `rotate(-90)`, `rotate(90)` about the right centers, no bottom-right eye, dark modules inside eye boxes skipped, logo clears modules, custom tile referenced), `scanCheck` (warns on an unreadable render).
- Component tests (Testing Library): `StylePanel` uploads (valid, wrong type, too large, unsafe), remove falls back, selectors labeled; `QrPreview` renders the SVG, shows capacity errors (with and without logo).
- Playwright: bundled shapes round-trip (decode downloaded PNG); upload a sample eye SVG fixture, download PNG and decode it to the input, download SVG and assert the three rotations and absence of unsafe content; emoji and accented text round-trip; upload a malicious SVG and assert it is neutralized.

## Delivery

- New ADR superseding the library ADR; update manual, features, config (none new), backlog (dropped dot styles, gradients, split eye SVGs), changes, `CLAUDE.md`.
- Branch `feat/svg-renderer`, off `main` (PR #1 with the base app is merged); lands via Pull Request.
