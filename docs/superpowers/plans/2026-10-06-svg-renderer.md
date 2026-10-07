# Own SVG Renderer with Custom Eye and Dot Shapes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `qr-code-styling` with an own SVG renderer so the user can upload an SVG for the three corner eyes (top-left 0°, top-right -90°, bottom-left +90°) and an optional SVG for every data dot.

**Architecture:** Pure, independently tested functions under `app/utils/qr/` (matrix, shapes, sanitizer, SVG renderer, rasterizer, scan check). One SVG string is the preview and the SVG download; PNG is that SVG drawn on a canvas. `QrPreview`/`StylePanel` stay thin. Task 6 switches the app over atomically so the suite and the app stay green after every task.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, `qrcode-generator` (matrix), `jsqr` (scan check, now a runtime dependency), Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-06-svg-renderer-design.md` (extends `2026-10-06-qr-code-builder-design.md`)

## Global Constraints

- TypeScript/Vue 3/Nuxt 4 only; Tailwind for styling; no backend, no database; uploaded SVGs and logos never leave the browser.
- Eye rotations about each 7×7-module box center: top-left `0`, top-right `-90`, bottom-left `90`; no eye at bottom-right.
- Quiet zone is 4 modules; eye box is 7×7 modules; logo covers 25% of the module count per side with a 1-module clear pad.
- Error correction is forced to `H` when a logo is present.
- Uploaded SVG limits: `image/svg+xml` (or `.svg` name), at most 200 KB (`MAX_SVG_BYTES = 200 * 1024`), at most 2,000 elements, square within ±5%, must have a `viewBox` or numeric `width`/`height`.
- Uploaded SVGs keep their own colors; the foreground color applies only to bundled shapes; the background color always applies.
- A failed scan check is a warning (`role="status"`), never a block.
- Config in `.env` files; `NUXT_ADD_DEBUG_LOGS` gates trace logging (`debugLog` from `~/utils/log`); errors always `console.error` with context.
- Unit tests with Vitest; component tests with Testing Library (query by role/label); UI automation with Playwright scripts.
- Components import `ref/computed/...` explicitly from `vue`.
- Git: work only on branch `feat/svg-renderer`; commit prefixes `feat:` `bugfix:` `secfix:` `refactor:` `config:` `docs:`; end every commit message with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; nothing is committed to `main`; changes land via Pull Request.
- Heads-up from the previous plan: when writing regexes or strings containing a backslash followed by a semicolon or similar, verify the file bytes after writing (`grep -n`), because a backslash was once silently dropped.

## Review Focus

- A malicious SVG upload (script, `on*` handlers, external href/`url()`/`@import`, `foreignObject`, `javascript:`) is neutralized in the preview and in the downloaded SVG, and opening the downloaded SVG standalone runs nothing. (Tasks 3, 8)
- Accented and emoji text (`héllo 🌍`) is encoded as UTF-8 and scans back. (Tasks 1, 8)
- Uploads that are not SVG, too large, malformed or not square show a visible message and leave the previous shape in place. (Tasks 3, 7)
- An eye SVG and a dot SVG that both define the same `id` (e.g. a gradient `g`) do not collide in the rendered SVG. (Tasks 3, 4)
- Dense codes (version 10+, e.g. 2,000 characters) render with custom tiles and a logo, and over-capacity input shows the right message with and without a logo. (Tasks 1, 4, 6)

## File Structure

```
app/utils/qr/matrix.ts        buildMatrix, QrMatrix, QrCapacityError
app/utils/qr/shapes.ts        DotShape, EyeShape, dotMarkup, eyeMarkup, safeColor
app/utils/qr/sanitizeSvg.ts   sanitizeSvg, SanitizedSvg, SanitizeResult, MAX_SVG_BYTES
app/utils/qr/renderSvg.ts     renderSvg, RenderStyle, QUIET_ZONE, EYE_SIZE
app/utils/qr/rasterize.ts     svgToImageData, svgToPng (browser only)
app/utils/qr/scanCheck.ts     scansBack
app/utils/qr/upload.ts        loadSvgUpload, readFileText
app/utils/qrOptions.ts        StyleState (dotShape/eyeShape/customDot/customEye), defaultStyle; buildQrOptions removed
app/components/QrPreview.vue  rewritten (text + qrStyle props)
app/components/StylePanel.vue shape selects + two SVG uploads
app/pages/index.vue           passes payload text + style
tests/unit/helpers/qr.ts      matrixToRgba, decodeMatrix (jsQR) test helpers
tests/unit/{matrix,shapes,sanitizeSvg,renderSvg,rasterize,scanCheck,upload}.test.ts
tests/e2e/fixtures/{eye,dot,bad-eye,malicious}.svg
tests/e2e/svg-shapes.spec.ts
docs/...
```

---

### Task 1: QR matrix with UTF-8

**Files:**
- Create: `app/utils/qr/matrix.ts`, `tests/unit/helpers/qr.ts`
- Test: `tests/unit/matrix.test.ts`
- Modify: `package.json` (add `qrcode-generator`)

**Interfaces:**
- Consumes: `ErrorLevel` (`'L'|'M'|'Q'|'H'`) from `~/utils/qrOptions`.
- Produces:
  - `interface QrMatrix { size: number; isDark(row: number, col: number): boolean }`
  - `class QrCapacityError extends Error`
  - `buildMatrix(text: string, level: ErrorLevel): QrMatrix` (throws `QrCapacityError` when the content does not fit)
  - test helpers `matrixToRgba(m, scale = 8, quiet = 4)` and `decodeMatrix(m): string | undefined` in `tests/unit/helpers/qr.ts`

- [ ] **Step 1: Install the dependency**

Run: `npm install qrcode-generator`
Expected: added; check `node_modules/qrcode-generator/package.json` for the version and that it exposes `stringToBytesFuncs` (`grep -n "stringToBytesFuncs" node_modules/qrcode-generator/*.d.ts node_modules/qrcode-generator/*.js | head`). If the API differs from the code below, adapt minimally and record the ruling.

- [ ] **Step 2: Write the test helper and failing tests**

`tests/unit/helpers/qr.ts`:
```ts
import jsQR from 'jsqr'
import type { QrMatrix } from '~/utils/qr/matrix'

export function matrixToRgba(m: QrMatrix, scale = 8, quiet = 4) {
  const side = (m.size + quiet * 2) * scale
  const data = new Uint8ClampedArray(side * side * 4).fill(255)
  for (let r = 0; r < m.size; r++) {
    for (let c = 0; c < m.size; c++) {
      if (!m.isDark(r, c)) continue
      for (let y = 0; y < scale; y++) {
        for (let x = 0; x < scale; x++) {
          const i = (((r + quiet) * scale + y) * side + (c + quiet) * scale + x) * 4
          data[i] = data[i + 1] = data[i + 2] = 0
        }
      }
    }
  }
  return { data, width: side, height: side }
}

export function decodeMatrix(m: QrMatrix): string | undefined {
  const { data, width, height } = matrixToRgba(m)
  return jsQR(data, width, height)?.data
}
```

`tests/unit/matrix.test.ts`:
```ts
import { buildMatrix, QrCapacityError } from '~/utils/qr/matrix'
import { decodeMatrix } from './helpers/qr'

describe('buildMatrix', () => {
  it('builds a square matrix with the finder pattern in the top-left corner', () => {
    const m = buildMatrix('hello', 'M')
    expect(m.size).toBe(21)
    for (let c = 0; c < 7; c++) expect(m.isDark(0, c)).toBe(true)
    expect(m.isDark(0, 7)).toBe(false)
    expect(m.isDark(1, 1)).toBe(false)
    expect(m.isDark(2, 2)).toBe(true)
  })

  it('grows with the amount of data and with the error-correction level', () => {
    expect(buildMatrix('x'.repeat(200), 'M').size).toBeGreaterThan(buildMatrix('hi', 'M').size)
    expect(buildMatrix('x'.repeat(100), 'H').size).toBeGreaterThanOrEqual(buildMatrix('x'.repeat(100), 'L').size)
  })

  it('round-trips ASCII', () => {
    expect(decodeMatrix(buildMatrix('hello', 'M'))).toBe('hello')
  })

  it('round-trips accented characters and emoji as UTF-8', () => {
    const text = 'héllo ñandú 🌍'
    expect(decodeMatrix(buildMatrix(text, 'M'))).toBe(text)
  })

  it('round-trips a dense code (version 10+)', () => {
    const text = 'BEGIN:VCARD\n' + 'line of text 0123456789 '.repeat(40)
    const m = buildMatrix(text, 'M')
    expect(m.size).toBeGreaterThanOrEqual(57)
    expect(decodeMatrix(m)).toBe(text)
  })

  it('throws QrCapacityError when the content cannot fit', () => {
    expect(() => buildMatrix('x'.repeat(5000), 'H')).toThrow(QrCapacityError)
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run tests/unit/matrix.test.ts`
Expected: FAIL — cannot resolve `~/utils/qr/matrix`.

- [ ] **Step 4: Implement** — `app/utils/qr/matrix.ts`

```ts
import qrcode from 'qrcode-generator'
import type { ErrorLevel } from '~/utils/qrOptions'

// The default encoder is ISO-8859-1, which corrupts accents and emoji.
qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8']!

export class QrCapacityError extends Error {
  constructor() {
    super('Content does not fit in a QR code')
    this.name = 'QrCapacityError'
  }
}

export interface QrMatrix {
  size: number
  isDark(row: number, col: number): boolean
}

export function buildMatrix(text: string, level: ErrorLevel): QrMatrix {
  const qr = qrcode(0, level)
  qr.addData(text, 'Byte')
  try {
    qr.make()
  } catch {
    throw new QrCapacityError()
  }
  return { size: qr.getModuleCount(), isDark: (row, col) => qr.isDark(row, col) }
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run tests/unit/matrix.test.ts`
Expected: all PASS. Then `npm test` — Expected: whole suite PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json app/utils/qr/matrix.ts tests/unit/helpers/qr.ts tests/unit/matrix.test.ts
git commit -m "feat: add UTF-8 QR matrix builder" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Bundled shapes

**Files:**
- Create: `app/utils/qr/shapes.ts`
- Test: `tests/unit/shapes.test.ts`

**Interfaces:**
- Produces:
  - `type DotShape = 'square' | 'dots' | 'rounded'`; `type EyeShape = 'square' | 'rounded' | 'dot'`
  - `dotMarkup(shape: DotShape, fill: string): string` — markup in a 0..1 box
  - `eyeMarkup(shape: EyeShape, fill: string): string` — markup in a 0..7 box (outer frame + inner dot)
  - `safeColor(value: string, fallback: string): string` — returns `value` only if it matches `#rrggbb`, else `fallback`

- [ ] **Step 1: Write the failing tests** — `tests/unit/shapes.test.ts`

```ts
import { dotMarkup, eyeMarkup, safeColor, type DotShape, type EyeShape } from '~/utils/qr/shapes'

const wrap = (inner: string) =>
  new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${inner}</svg>`, 'image/svg+xml')

describe('dotMarkup', () => {
  it.each<[DotShape, string]>([
    ['square', 'rect'],
    ['dots', 'circle'],
    ['rounded', 'rect'],
  ])('%s is well-formed SVG using the fill color', (shape, tag) => {
    const markup = dotMarkup(shape, '#112233')
    const doc = wrap(markup)
    expect(doc.querySelector('parsererror')).toBeNull()
    expect(doc.querySelector(tag)).not.toBeNull()
    expect(markup).toContain('#112233')
  })
})

describe('eyeMarkup', () => {
  it.each<EyeShape>(['square', 'rounded', 'dot'])('%s has an outer frame and an inner dot in a 7x7 box', (shape) => {
    const markup = eyeMarkup(shape, '#445566')
    const doc = wrap(markup)
    expect(doc.querySelector('parsererror')).toBeNull()
    expect(doc.documentElement.children.length).toBeGreaterThanOrEqual(2)
    expect(markup).toContain('#445566')
  })
})

describe('safeColor', () => {
  it('accepts #rrggbb and rejects anything else', () => {
    expect(safeColor('#AbCdEf', '#000000')).toBe('#AbCdEf')
    expect(safeColor('red', '#000000')).toBe('#000000')
    expect(safeColor('"><script>', '#000000')).toBe('#000000')
    expect(safeColor('#12345', '#000000')).toBe('#000000')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/shapes.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — `app/utils/qr/shapes.ts`

```ts
export type DotShape = 'square' | 'dots' | 'rounded'
export type EyeShape = 'square' | 'rounded' | 'dot'

const HEX = /^#[0-9a-f]{6}$/i

export function safeColor(value: string, fallback: string): string {
  return HEX.test(value) ? value : fallback
}

export function dotMarkup(shape: DotShape, fill: string): string {
  switch (shape) {
    case 'square':
      return `<rect width="1" height="1" fill="${fill}"/>`
    case 'dots':
      return `<circle cx="0.5" cy="0.5" r="0.45" fill="${fill}"/>`
    case 'rounded':
      return `<rect width="1" height="1" rx="0.3" fill="${fill}"/>`
  }
}

export function eyeMarkup(shape: EyeShape, fill: string): string {
  switch (shape) {
    case 'square':
      return (
        `<path fill="${fill}" fill-rule="evenodd" d="M0 0h7v7H0zM1 1h5v5H1z"/>` +
        `<rect x="2" y="2" width="3" height="3" fill="${fill}"/>`
      )
    case 'rounded':
      return (
        `<rect x="0.5" y="0.5" width="6" height="6" rx="1.5" fill="none" stroke="${fill}" stroke-width="1"/>` +
        `<rect x="2" y="2" width="3" height="3" rx="0.8" fill="${fill}"/>`
      )
    case 'dot':
      return (
        `<circle cx="3.5" cy="3.5" r="3" fill="none" stroke="${fill}" stroke-width="1"/>` +
        `<circle cx="3.5" cy="3.5" r="1.5" fill="${fill}"/>`
      )
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/unit/shapes.test.ts` — Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add app/utils/qr/shapes.ts tests/unit/shapes.test.ts
git commit -m "feat: add bundled SVG dot and eye shapes" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: SVG sanitizer

**Files:**
- Create: `app/utils/qr/sanitizeSvg.ts`
- Test: `tests/unit/sanitizeSvg.test.ts`

**Interfaces:**
- Produces:
  - `interface SanitizedSvg { viewBox: string; inner: string }` (`inner` is a `<g xmlns="http://www.w3.org/2000/svg" ...>...</g>` string with every id prefixed)
  - `type SanitizeResult = { ok: true; svg: SanitizedSvg } | { ok: false; error: string }`
  - `MAX_SVG_BYTES = 200 * 1024`
  - `sanitizeSvg(markup: string, idPrefix: string): SanitizeResult`

- [ ] **Step 1: Write the failing tests** — `tests/unit/sanitizeSvg.test.ts`

```ts
import { MAX_SVG_BYTES, sanitizeSvg } from '~/utils/qr/sanitizeSvg'

const NS = 'xmlns="http://www.w3.org/2000/svg"'
const ok = (markup: string, prefix = 'eye-') => {
  const r = sanitizeSvg(markup, prefix)
  if (!r.ok) throw new Error(`expected ok, got: ${r.error}`)
  return r.svg
}
const err = (markup: string) => {
  const r = sanitizeSvg(markup, 'eye-')
  if (r.ok) throw new Error('expected an error')
  return r.error
}

describe('sanitizeSvg: accepting valid files', () => {
  it('accepts a square svg with a viewBox and keeps its shapes', () => {
    const svg = ok(`<svg ${NS} viewBox="0 0 7 7"><rect width="7" height="7" fill="#123456"/></svg>`)
    expect(svg.viewBox).toBe('0 0 7 7')
    expect(svg.inner).toContain('<rect')
    expect(svg.inner).toContain('#123456')
  })
  it('falls back to numeric width and height', () => {
    expect(ok(`<svg ${NS} width="40px" height="40"><circle r="5"/></svg>`).viewBox).toBe('0 0 40 40')
  })
  it('carries presentation attributes from the root onto the wrapper group', () => {
    expect(ok(`<svg ${NS} viewBox="0 0 7 7" fill="#abcdef"><rect width="7" height="7"/></svg>`).inner).toContain('fill="#abcdef"')
  })
})

describe('sanitizeSvg: rejecting bad files', () => {
  it('rejects malformed markup and non-svg roots', () => {
    expect(err('<svg viewBox="0 0 1 1"><rect></svg>')).toMatch(/not a valid svg/i)
    expect(err('<html xmlns="http://www.w3.org/1999/xhtml"></html>')).toMatch(/not an svg/i)
  })
  it('rejects non-square files', () => {
    expect(err(`<svg ${NS} viewBox="0 0 10 5"><rect width="10" height="5"/></svg>`)).toMatch(/square/i)
  })
  it('rejects files without a usable size', () => {
    expect(err(`<svg ${NS}><rect width="1" height="1"/></svg>`)).toMatch(/viewBox/i)
    expect(err(`<svg ${NS} width="100%" height="100%"><rect/></svg>`)).toMatch(/viewBox/i)
  })
  it('rejects files over the size limit', () => {
    const big = `<svg ${NS} viewBox="0 0 1 1"><!--${'x'.repeat(MAX_SVG_BYTES)}--></svg>`
    expect(err(big)).toMatch(/200 KB/)
  })
  it('rejects files with too many elements', () => {
    const many = `<svg ${NS} viewBox="0 0 1 1">${'<rect/>'.repeat(2001)}</svg>`
    expect(err(many)).toMatch(/too complex/i)
  })
})

describe('sanitizeSvg: neutralizing unsafe content', () => {
  it('removes scripts, foreignObject and animation elements', () => {
    const svg = ok(
      `<svg ${NS} viewBox="0 0 7 7"><script>alert(1)</script><foreignObject><div/></foreignObject>` +
        `<animate attributeName="x"/><set attributeName="x"/><rect width="7" height="7"/></svg>`,
    )
    expect(svg.inner).not.toMatch(/script|foreignobject|animate|<set/i)
    expect(svg.inner).toContain('<rect')
  })
  it('removes event handler attributes', () => {
    const svg = ok(`<svg ${NS} viewBox="0 0 7 7" onload="x()"><rect onclick="x()" onmouseover="x()" width="7" height="7"/></svg>`)
    expect(svg.inner).not.toMatch(/onload|onclick|onmouseover|x\(\)/i)
  })
  it('removes external and javascript hrefs but keeps local ones and data images', () => {
    const svg = ok(
      `<svg ${NS} xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 7 7">` +
        `<image href="http://evil.example/x.png" width="1" height="1"/>` +
        `<a href="javascript:alert(1)"><rect width="1" height="1"/></a>` +
        `<defs><rect id="r" width="1" height="1"/></defs><use xlink:href="#r"/>` +
        `<image href="data:image/png;base64,AAAA" width="1" height="1"/></svg>`,
    )
    expect(svg.inner).not.toMatch(/evil\.example|javascript/i)
    expect(svg.inner).toContain('#eye-r')
    expect(svg.inner).toContain('data:image/png;base64,AAAA')
  })
  it('drops external url() references and strips @import from style', () => {
    const svg = ok(
      `<svg ${NS} viewBox="0 0 7 7"><style>@import url(http://evil.example/a.css); .a { fill: red }</style>` +
        `<rect class="a" fill="url(http://evil.example/a.svg#x)" style="fill:url(http://evil.example/b.svg#y)" width="7" height="7"/></svg>`,
    )
    expect(svg.inner).not.toMatch(/evil\.example|@import/i)
    expect(svg.inner).toContain('fill: red')
  })
})

describe('sanitizeSvg: id prefixing', () => {
  const gradient =
    `<svg ${NS} viewBox="0 0 7 7"><defs><linearGradient id="g"><stop offset="0" stop-color="#000"/></linearGradient></defs>` +
    `<rect width="7" height="7" fill="url(#g)"/></svg>`
  it('prefixes ids and rewrites local references', () => {
    const svg = ok(gradient, 'eye-')
    expect(svg.inner).toContain('id="eye-g"')
    expect(svg.inner).toContain('url(#eye-g)')
    expect(svg.inner).not.toMatch(/id="g"/)
  })
  it('gives two uploads with the same ids different ids', () => {
    const a = ok(gradient, 'eye-').inner
    const b = ok(gradient, 'dot-').inner
    expect(a).toContain('id="eye-g"')
    expect(b).toContain('id="dot-g"')
  })
  it('rewrites id selectors inside style elements', () => {
    const svg = ok(`<svg ${NS} viewBox="0 0 7 7"><style>#a { fill: red }</style><rect id="a" width="7" height="7"/></svg>`, 'dot-')
    expect(svg.inner).toContain('#dot-a')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/sanitizeSvg.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — `app/utils/qr/sanitizeSvg.ts`

```ts
export interface SanitizedSvg {
  viewBox: string
  inner: string
}
export type SanitizeResult = { ok: true; svg: SanitizedSvg } | { ok: false; error: string }

export const MAX_SVG_BYTES = 200 * 1024
const MAX_NODES = 2000
const SVG_NS = 'http://www.w3.org/2000/svg'

const FORBIDDEN = new Set([
  'script', 'foreignobject', 'iframe', 'object', 'embed', 'audio', 'video',
  'set', 'animate', 'animatetransform', 'animatemotion', 'animatecolor',
])
const ROOT_PRESENTATION = ['fill', 'stroke', 'stroke-width', 'fill-rule', 'clip-rule', 'opacity']
const DATA_IMAGE_RE = /^data:image\/(png|jpeg|gif|webp);base64,/i
const URL_REF_RE = /url\(\s*(['"]?)#([^)'"\s]+)\1\s*\)/g

const fail = (error: string): SanitizeResult => ({ ok: false, error })

function readViewBox(root: Element): [number, number, number, number] | null {
  const vb = root.getAttribute('viewBox')
  if (vb) {
    const p = vb.trim().split(/[\s,]+/).map(Number)
    if (p.length === 4 && p.every(Number.isFinite) && p[2]! > 0 && p[3]! > 0) return p as [number, number, number, number]
    return null
  }
  const num = /^\s*(\d+(\.\d+)?)(px)?\s*$/
  const w = num.exec(root.getAttribute('width') ?? '')
  const h = num.exec(root.getAttribute('height') ?? '')
  if (!w || !h) return null
  const [wn, hn] = [parseFloat(w[1]!), parseFloat(h[1]!)]
  return wn > 0 && hn > 0 ? [0, 0, wn, hn] : null
}

// Every url(...) must be a local reference; anything else is dropped.
const onlyLocalUrls = (value: string) =>
  (value.match(/url\(/gi) ?? []).length === (value.match(/url\(\s*['"]?#/gi) ?? []).length

const cleanCss = (css: string) =>
  css.replace(/@import[^;]*;?/gi, '').replace(/url\(\s*(?!['"]?#)[^)]*\)/gi, 'none')

export function sanitizeSvg(markup: string, idPrefix: string): SanitizeResult {
  if (new TextEncoder().encode(markup).length > MAX_SVG_BYTES) return fail('SVG is larger than 200 KB.')

  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml')
  const root = doc.documentElement
  if (!root || doc.querySelector('parsererror')) return fail('Not a valid SVG file.')
  if (root.localName.toLowerCase() !== 'svg') return fail('Not an SVG file.')
  if (root.querySelectorAll('*').length > MAX_NODES) return fail('SVG is too complex (over 2,000 elements).')

  const box = readViewBox(root)
  if (!box) return fail('SVG needs a viewBox or numeric width and height.')
  if (Math.abs(box[2] / box[3] - 1) > 0.05) return fail('SVG must be square (width and height within 5%).')

  for (const el of Array.from(root.querySelectorAll('*'))) {
    if (FORBIDDEN.has(el.localName.toLowerCase())) el.remove()
  }

  const ids = new Set<string>()
  for (const el of Array.from(root.querySelectorAll('[id]'))) ids.add(el.getAttribute('id')!)
  const renameRefs = (text: string) =>
    text.replace(URL_REF_RE, (m, _q: string, id: string) => (ids.has(id) ? `url(#${idPrefix}${id})` : m))

  for (const el of Array.from(root.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase()
      let value = attr.value
      if (name.startsWith('on') || /javascript:/i.test(value)) {
        el.removeAttribute(attr.name)
        continue
      }
      if (name === 'href' || name === 'xlink:href') {
        if (value.startsWith('#')) {
          if (ids.has(value.slice(1))) el.setAttribute(attr.name, `#${idPrefix}${value.slice(1)}`)
        } else if (!DATA_IMAGE_RE.test(value)) {
          el.removeAttribute(attr.name)
        }
        continue
      }
      if (name === 'id') {
        el.setAttribute(attr.name, idPrefix + value)
        continue
      }
      if (name === 'style') {
        value = cleanCss(value)
      } else if (/url\(/i.test(value) && !onlyLocalUrls(value)) {
        el.removeAttribute(attr.name)
        continue
      }
      value = renameRefs(value)
      if (value !== attr.value) el.setAttribute(attr.name, value)
    }
    if (el.localName.toLowerCase() === 'style') {
      el.textContent = renameRefs(cleanCss(el.textContent ?? '')).replace(/#([\w-]+)/g, (m, id: string) =>
        ids.has(id) ? `#${idPrefix}${id}` : m,
      )
    }
  }

  const wrapper = doc.createElementNS(SVG_NS, 'g')
  for (const name of ROOT_PRESENTATION) {
    const v = root.getAttribute(name)
    if (v !== null && !/url\(/i.test(v)) wrapper.setAttribute(name, v)
  }
  wrapper.append(...Array.from(root.childNodes))

  return { ok: true, svg: { viewBox: box.join(' '), inner: new XMLSerializer().serializeToString(wrapper) } }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/unit/sanitizeSvg.test.ts` — Expected: all PASS. If a case fails because the serializer or jsdom differs from the test's assumption (e.g. attribute order), fix the code, not the intent of the test; if the test's assumption is wrong, ledger a ruling.

- [ ] **Step 5: Verify backslashes survived the write**

Run: `grep -n "URL_REF_RE =\|DATA_IMAGE_RE =" app/utils/qr/sanitizeSvg.ts`
Expected: the regexes contain `\(`, `\s`, `\/` exactly as written above.

- [ ] **Step 6: Commit**

```bash
git add app/utils/qr/sanitizeSvg.ts tests/unit/sanitizeSvg.test.ts
git commit -m "secfix: add SVG sanitizer for uploaded eye and dot shapes" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: SVG renderer

**Files:**
- Create: `app/utils/qr/renderSvg.ts`
- Modify: `app/utils/qrOptions.ts` (additive: new `StyleState` fields; old fields stay until Task 6)
- Test: `tests/unit/renderSvg.test.ts`

**Interfaces:**
- Consumes: `QrMatrix`, `buildMatrix` (Task 1); `dotMarkup`, `eyeMarkup`, `safeColor`, `DotShape`, `EyeShape` (Task 2); `SanitizedSvg`, `sanitizeSvg` (Task 3).
- Produces:
  - `StyleState` gains `dotShape: DotShape | 'custom'`, `eyeShape: EyeShape | 'custom'`, `customDot: SanitizedSvg | null`, `customEye: SanitizedSvg | null`; `defaultStyle()` sets `'square'`, `'square'`, `null`, `null`
  - `type RenderStyle = Pick<StyleState, 'fg' | 'bg' | 'size' | 'dotShape' | 'eyeShape' | 'customDot' | 'customEye' | 'logo'>`
  - `QUIET_ZONE = 4`, `EYE_SIZE = 7`
  - `renderSvg(m: QrMatrix, style: RenderStyle): string` — the SVG uses `<symbol id="qrb-dot">`, `<symbol id="qrb-eye">`, one `<use href="#qrb-dot" x y width="1" height="1"/>` per drawn dark module, three `<use href="#qrb-eye" ... transform="rotate(A CX CY)"/>`, optional `<image>` for the logo

- [ ] **Step 1: Write the failing tests** — `tests/unit/renderSvg.test.ts`

```ts
import { buildMatrix } from '~/utils/qr/matrix'
import { renderSvg, QUIET_ZONE } from '~/utils/qr/renderSvg'
import { sanitizeSvg, type SanitizedSvg } from '~/utils/qr/sanitizeSvg'
import { defaultStyle } from '~/utils/qrOptions'

const NS = 'xmlns="http://www.w3.org/2000/svg"'
const m = buildMatrix('hello world', 'M')
const n = m.size
const q = QUIET_ZONE
const base = () => ({ ...defaultStyle() })
const dotUses = (svg: string) =>
  [...svg.matchAll(/<use href="#qrb-dot" x="(\d+)" y="(\d+)"/g)].map((x) => [Number(x[1]) - q, Number(x[2]) - q] as const)
const inEyeBox = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7)
const custom = (markup: string, prefix: string): SanitizedSvg => {
  const r = sanitizeSvg(markup, prefix)
  if (!r.ok) throw new Error(r.error)
  return r.svg
}

describe('renderSvg layout', () => {
  it('sizes the svg and the viewBox including the quiet zone and fills the background', () => {
    const svg = renderSvg(m, { ...base(), size: 400, bg: '#eeeeee' })
    expect(svg).toContain('width="400" height="400"')
    expect(svg).toContain(`viewBox="0 0 ${n + 2 * q} ${n + 2 * q}"`)
    expect(svg).toContain('fill="#eeeeee"')
  })

  it('places three eyes rotated 0, -90 and 90 about their centers, none bottom-right', () => {
    const svg = renderSvg(m, base())
    expect([...svg.matchAll(/<use href="#qrb-eye"/g)]).toHaveLength(3)
    const c = (v: number) => v + q + 3.5
    expect(svg).toContain(`rotate(0 ${c(0)} ${c(0)})`)
    expect(svg).toContain(`rotate(-90 ${c(n - 7)} ${c(0)})`)
    expect(svg).toContain(`rotate(90 ${c(0)} ${c(n - 7)})`)
  })

  it('draws exactly the dark modules outside the three eye boxes', () => {
    const svg = renderSvg(m, base())
    let expected = 0
    for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) if (m.isDark(r, col) && !inEyeBox(r, col)) expected++
    const uses = dotUses(svg)
    expect(uses).toHaveLength(expected)
    expect(uses.some(([r0, c0]) => inEyeBox(c0, r0))).toBe(false)
  })

  it('uses the foreground color for bundled shapes', () => {
    expect(renderSvg(m, { ...base(), fg: '#112233' })).toContain('fill="#112233"')
  })

  it('falls back to safe colors for invalid color values', () => {
    const svg = renderSvg(m, { ...base(), fg: '"><script>alert(1)</script>', bg: 'red' })
    expect(svg).not.toMatch(/script|red/)
  })
})

describe('renderSvg custom shapes', () => {
  const eye = custom(`<svg ${NS} viewBox="0 0 7 7"><rect width="7" height="7" fill="#aa0000"/></svg>`, 'eye-')
  const dot = custom(`<svg ${NS} viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="#0000aa"/></svg>`, 'dot-')

  it('uses the uploaded eye and dot (keeping their own colors) when set to custom', () => {
    const svg = renderSvg(m, { ...base(), eyeShape: 'custom', customEye: eye, dotShape: 'custom', customDot: dot, fg: '#00ff00' })
    expect(svg).toContain('<symbol id="qrb-eye" viewBox="0 0 7 7">')
    expect(svg).toContain('#aa0000')
    expect(svg).toContain('<symbol id="qrb-dot" viewBox="0 0 10 10">')
    expect(svg).toContain('#0000aa')
    expect(svg).not.toContain('#00ff00')
  })

  it('falls back to the square bundled shape if custom is chosen without an upload', () => {
    const svg = renderSvg(m, { ...base(), eyeShape: 'custom', customEye: null, dotShape: 'custom', customDot: null })
    expect(svg).toContain('<symbol id="qrb-dot" viewBox="0 0 1 1">')
    expect(svg).toContain('<symbol id="qrb-eye" viewBox="0 0 7 7">')
  })

  it('keeps ids unique when the eye and the dot define the same id', () => {
    const gradient = (color: string) =>
      `<svg ${NS} viewBox="0 0 7 7"><defs><linearGradient id="g"><stop offset="0" stop-color="${color}"/></linearGradient></defs><rect width="7" height="7" fill="url(#g)"/></svg>`
    const svg = renderSvg(m, {
      ...base(),
      eyeShape: 'custom',
      customEye: custom(gradient('#111111'), 'eye-'),
      dotShape: 'custom',
      customDot: custom(gradient('#222222'), 'dot-'),
    })
    const ids = [...svg.matchAll(/ id="([^"]+)"/g)].map((x) => x[1])
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('eye-g')
    expect(ids).toContain('dot-g')
  })
})

describe('renderSvg logo', () => {
  const logo = 'data:image/png;base64,AAAA'
  it('embeds the logo centered and clears the modules behind it', () => {
    const without = dotUses(renderSvg(m, base())).length
    const svg = renderSvg(m, { ...base(), logo })
    expect(svg).toContain(`<image href="${logo}"`)
    expect(dotUses(svg).length).toBeLessThan(without)
  })
  it('ignores a logo that is not a data image', () => {
    expect(renderSvg(m, { ...base(), logo: 'http://evil.example/x.png' })).not.toMatch(/<image|evil/)
  })
})

describe('renderSvg dense codes', () => {
  it('renders a version 10+ code with custom tiles and a logo', () => {
    const big = buildMatrix('0123456789 '.repeat(130), 'M')
    expect(big.size).toBeGreaterThanOrEqual(57)
    const dot = custom(`<svg ${NS} viewBox="0 0 1 1"><rect width="1" height="1"/></svg>`, 'dot-')
    const svg = renderSvg(big, { ...base(), dotShape: 'custom', customDot: dot, logo: 'data:image/png;base64,AAAA' })
    expect(new DOMParser().parseFromString(svg, 'image/svg+xml').querySelector('parsererror')).toBeNull()
    expect(dotUses(svg).length).toBeGreaterThan(1000)
  })
})
```

Note on the "inEyeBox" assertion: `dotUses` returns `[col, row]` pairs (x then y), so the test passes `(c0, r0)` swapped into `inEyeBox(row, col)` on purpose; keep it exactly as written.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/renderSvg.test.ts` — Expected: FAIL (module not found / `dotShape` unknown).

- [ ] **Step 3: Extend `StyleState` additively** — `app/utils/qrOptions.ts`

Add the import `import type { DotShape, EyeShape } from '~/utils/qr/shapes'` and `import type { SanitizedSvg } from '~/utils/qr/sanitizeSvg'`; add to `interface StyleState`:
```ts
  dotShape: DotShape | 'custom'
  eyeShape: EyeShape | 'custom'
  customDot: SanitizedSvg | null
  customEye: SanitizedSvg | null
```
and to `defaultStyle()`:
```ts
  dotShape: 'square',
  eyeShape: 'square',
  customDot: null,
  customEye: null,
```
(Leave `dotStyle`, `cornerStyle` and `buildQrOptions` untouched; Task 6 removes them.)

- [ ] **Step 4: Implement** — `app/utils/qr/renderSvg.ts`

```ts
import type { QrMatrix } from '~/utils/qr/matrix'
import { dotMarkup, eyeMarkup, safeColor } from '~/utils/qr/shapes'
import type { StyleState } from '~/utils/qrOptions'

export type RenderStyle = Pick<StyleState, 'fg' | 'bg' | 'size' | 'dotShape' | 'eyeShape' | 'customDot' | 'customEye' | 'logo'>

export const QUIET_ZONE = 4
export const EYE_SIZE = 7
const LOGO_RATIO = 0.25
const LOGO_PAD = 1
const LOGO_RE = /^data:image\/(png|jpeg|svg\+xml);base64,[A-Za-z0-9+/=]+$/

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

export function renderSvg(m: QrMatrix, style: RenderStyle): string {
  const n = m.size
  const q = QUIET_ZONE
  const total = n + 2 * q
  const fg = safeColor(style.fg, '#000000')
  const bg = safeColor(style.bg, '#ffffff')
  const px = Number.isFinite(style.size) ? Math.max(1, Math.round(style.size)) : 300

  const bundledDot = style.dotShape === 'custom' ? 'square' : style.dotShape
  const bundledEye = style.eyeShape === 'custom' ? 'square' : style.eyeShape
  const dot =
    style.dotShape === 'custom' && style.customDot
      ? style.customDot
      : { viewBox: '0 0 1 1', inner: dotMarkup(bundledDot, fg) }
  const eye =
    style.eyeShape === 'custom' && style.customEye
      ? style.customEye
      : { viewBox: '0 0 7 7', inner: eyeMarkup(bundledEye, fg) }

  const logo = style.logo && LOGO_RE.test(style.logo) ? style.logo : null
  const logoSide = logo ? n * LOGO_RATIO : 0
  const half = logo ? logoSide / 2 + LOGO_PAD : 0
  const mid = n / 2

  const inEyeBox = (r: number, c: number) =>
    (r < EYE_SIZE && c < EYE_SIZE) || (r < EYE_SIZE && c >= n - EYE_SIZE) || (r >= n - EYE_SIZE && c < EYE_SIZE)
  const behindLogo = (r: number, c: number) =>
    logo !== null && Math.abs(c + 0.5 - mid) <= half && Math.abs(r + 0.5 - mid) <= half

  const uses: string[] = []
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!m.isDark(r, c) || inEyeBox(r, c) || behindLogo(r, c)) continue
      uses.push(`<use href="#qrb-dot" x="${c + q}" y="${r + q}" width="1" height="1"/>`)
    }
  }

  const eyes = ([[0, 0, 0], [n - EYE_SIZE, 0, -90], [0, n - EYE_SIZE, 90]] as const).map(([ex, ey, angle]) => {
    const x = ex + q
    const y = ey + q
    return `<use href="#qrb-eye" x="${x}" y="${y}" width="${EYE_SIZE}" height="${EYE_SIZE}" transform="rotate(${angle} ${x + EYE_SIZE / 2} ${y + EYE_SIZE / 2})"/>`
  })

  const crisp = style.dotShape === 'square' ? ' shape-rendering="crispEdges"' : ''
  const logoMarkup = logo
    ? `<image href="${esc(logo)}" x="${q + (n - logoSide) / 2}" y="${q + (n - logoSide) / 2}" width="${logoSide}" height="${logoSide}" preserveAspectRatio="xMidYMid meet"/>`
    : ''

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${px}" height="${px}" viewBox="0 0 ${total} ${total}">` +
    `<defs><symbol id="qrb-dot" viewBox="${esc(dot.viewBox)}">${dot.inner}</symbol>` +
    `<symbol id="qrb-eye" viewBox="${esc(eye.viewBox)}">${eye.inner}</symbol></defs>` +
    `<rect width="${total}" height="${total}" fill="${bg}"/>` +
    `<g${crisp}>${uses.join('')}</g>${eyes.join('')}${logoMarkup}</svg>`
  )
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run tests/unit/renderSvg.test.ts` — Expected: all PASS. Then `npm test` — Expected: whole suite PASS.

- [ ] **Step 6: Commit**

```bash
git add app/utils/qr/renderSvg.ts app/utils/qrOptions.ts tests/unit/renderSvg.test.ts
git commit -m "feat: add SVG QR renderer with rotated eyes, custom tiles and logo" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Rasterizer and scan check

**Files:**
- Create: `app/utils/qr/rasterize.ts`, `app/utils/qr/scanCheck.ts`
- Test: `tests/unit/rasterize.test.ts`, `tests/unit/scanCheck.test.ts`

**Interfaces:**
- Consumes: `decodeMatrix`/`matrixToRgba` helpers and `buildMatrix` (Task 1).
- Produces:
  - `svgToImageData(svg: string, px: number): Promise<ImageData>`
  - `svgToPng(svg: string, px: number): Promise<Blob>` (`image/png`)
  - `scansBack(svg: string, expected: string, px = 400): Promise<boolean>` — rasterizes, runs `jsQR` (`inversionAttempts: 'attemptBoth'`), true only if the decoded text equals `expected`

- [ ] **Step 1: Write the failing tests**

`tests/unit/rasterize.test.ts`:
```ts
import { svgToPng, svgToImageData } from '~/utils/qr/rasterize'

let lastImage: { src: string } | null = null

class FakeImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  static fail = false
  set src(value: string) {
    lastImage = { src: value }
    queueMicrotask(() => (FakeImage.fail ? this.onerror?.() : this.onload?.()))
  }
}

describe('rasterize', () => {
  const drawImage = vi.fn()
  const getImageData = vi.fn(() => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }))

  beforeEach(() => {
    FakeImage.fail = false
    lastImage = null
    drawImage.mockClear()
    vi.stubGlobal('Image', FakeImage)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage, getImageData } as never)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => cb(new Blob(['png'], { type: 'image/png' })))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('loads the svg as a data URL and draws it at the requested size into a png', async () => {
    const blob = await svgToPng('<svg xmlns="http://www.w3.org/2000/svg"/>', 300)
    expect(blob.type).toBe('image/png')
    expect(lastImage!.src).toMatch(/^data:image\/svg\+xml/)
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 300, 300)
  })

  it('returns image data for the scan check', async () => {
    const data = await svgToImageData('<svg xmlns="http://www.w3.org/2000/svg"/>', 400)
    expect(getImageData).toHaveBeenCalledWith(0, 0, 400, 400)
    expect(data.width).toBe(1)
  })

  it('rejects when the svg cannot be loaded', async () => {
    FakeImage.fail = true
    await expect(svgToPng('<svg/>', 100)).rejects.toThrow(/rasterize/i)
  })

  it('rejects when png encoding fails', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => cb(null))
    await expect(svgToPng('<svg/>', 100)).rejects.toThrow(/png/i)
  })

  it('rejects when canvas 2d is unavailable', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    await expect(svgToPng('<svg/>', 100)).rejects.toThrow(/canvas/i)
  })
})
```

`tests/unit/scanCheck.test.ts`:
```ts
import { buildMatrix } from '~/utils/qr/matrix'
import { scansBack } from '~/utils/qr/scanCheck'
import { svgToImageData } from '~/utils/qr/rasterize'
import { matrixToRgba } from './helpers/qr'

vi.mock('~/utils/qr/rasterize', () => ({ svgToImageData: vi.fn() }))

describe('scansBack', () => {
  it('is true when the rendered code decodes to the expected text', async () => {
    vi.mocked(svgToImageData).mockResolvedValue(matrixToRgba(buildMatrix('hello', 'M')) as never)
    expect(await scansBack('<svg/>', 'hello')).toBe(true)
  })
  it('is false when it decodes to something else', async () => {
    vi.mocked(svgToImageData).mockResolvedValue(matrixToRgba(buildMatrix('other', 'M')) as never)
    expect(await scansBack('<svg/>', 'hello')).toBe(false)
  })
  it('is false when nothing can be decoded', async () => {
    const blank = { data: new Uint8ClampedArray(200 * 200 * 4).fill(255), width: 200, height: 200 }
    vi.mocked(svgToImageData).mockResolvedValue(blank as never)
    expect(await scansBack('<svg/>', 'hello')).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/rasterize.test.ts tests/unit/scanCheck.test.ts` — Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

`app/utils/qr/rasterize.ts`:
```ts
const toDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

function loadImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not rasterize the SVG'))
    img.src = toDataUrl(svg)
  })
}

function draw(img: HTMLImageElement, px: number) {
  const canvas = document.createElement('canvas')
  canvas.width = px
  canvas.height = px
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D is not available')
  ctx.drawImage(img, 0, 0, px, px)
  return { canvas, ctx }
}

export async function svgToImageData(svg: string, px: number): Promise<ImageData> {
  const { ctx } = draw(await loadImage(svg), px)
  return ctx.getImageData(0, 0, px, px)
}

export async function svgToPng(svg: string, px: number): Promise<Blob> {
  const { canvas } = draw(await loadImage(svg), px)
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed'))), 'image/png'),
  )
}
```

`app/utils/qr/scanCheck.ts`:
```ts
import jsQR from 'jsqr'
import { svgToImageData } from '~/utils/qr/rasterize'

export async function scansBack(svg: string, expected: string, px = 400): Promise<boolean> {
  const image = await svgToImageData(svg, px)
  const result = jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' })
  return result?.data === expected
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/unit/rasterize.test.ts tests/unit/scanCheck.test.ts` — Expected: all PASS. Then `npm test` — Expected: whole suite PASS.

- [ ] **Step 5: Commit**

```bash
git add app/utils/qr/rasterize.ts app/utils/qr/scanCheck.ts tests/unit/rasterize.test.ts tests/unit/scanCheck.test.ts
git commit -m "feat: add SVG rasterizer and decode-based scan check" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Switch the app to the SVG renderer

**Files:**
- Modify: `app/components/QrPreview.vue` (rewrite), `app/components/StylePanel.vue` (shape selects), `app/pages/index.vue`, `app/utils/qrOptions.ts` (remove old fields and `buildQrOptions`), `package.json`, `tests/e2e/qr.spec.ts`
- Test (rewrite/update): `tests/unit/QrPreview.test.ts`, `tests/unit/StylePanel.test.ts`, `tests/unit/qrOptions.test.ts`

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces:
  - `QrPreview` props `{ text: string | null; qrStyle: StyleState }` (the prop is named `qrStyle` because `style` is a reserved Vue attribute); emits `error(message: string | null)` and `scan(ok: boolean | null)`; exposes `download(ext: 'png' | 'svg'): Promise<void>`; root keeps `data-testid="qr-preview"`; shows the preview as `<img alt="QR code preview">`; capacity error messages: `This content is too long to fit in a QR code. Shorten it or lower the error-correction level.` and, when a logo is set, `This content is too long to fit in a QR code with a logo. Remove the logo or shorten the content.`
  - `StyleState` no longer has `dotStyle`/`cornerStyle`; `buildQrOptions` is deleted
  - `StylePanel` selects labeled `Dot shape` (Square/Dots/Rounded, plus `Custom SVG` option when `customDot` is set) and `Eye shape` (Square/Rounded/Dot, plus `Custom SVG` when `customEye` is set)

- [ ] **Step 1: Rewrite/update the tests first**

`tests/unit/QrPreview.test.ts` (replace the file):
```ts
import { mount } from '@vue/test-utils'
import { render, screen, waitFor } from '@testing-library/vue'
import QrPreview from '~/components/QrPreview.vue'
import { scansBack } from '~/utils/qr/scanCheck'
import { svgToPng } from '~/utils/qr/rasterize'
import { defaultStyle } from '~/utils/qrOptions'

vi.mock('~/utils/qr/scanCheck', () => ({ scansBack: vi.fn().mockResolvedValue(true) }))
vi.mock('~/utils/qr/rasterize', () => ({ svgToPng: vi.fn().mockResolvedValue(new Blob(['png'], { type: 'image/png' })) }))

const LONG = 'x'.repeat(5000)

describe('QrPreview', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(scansBack).mockResolvedValue(true)
  })
  afterEach(() => vi.restoreAllMocks())

  it('shows a placeholder when there is nothing to render', () => {
    render(QrPreview, { props: { text: null, qrStyle: defaultStyle() } })
    expect(screen.getByText(/fill in the form/i)).toBeInTheDocument()
  })

  it('renders the code as an svg image', () => {
    render(QrPreview, { props: { text: 'hello', qrStyle: defaultStyle() } })
    const img = screen.getByRole('img', { name: 'QR code preview' })
    expect(img.getAttribute('src')).toMatch(/^data:image\/svg\+xml/)
  })

  it('shows a clear error when content exceeds QR capacity and emits it', async () => {
    const { emitted } = render(QrPreview, { props: { text: LONG, qrStyle: defaultStyle() } })
    expect(await screen.findByRole('alert')).toHaveTextContent(/too long/i)
    expect(emitted().error?.at(-1)).toEqual([expect.stringMatching(/too long/i)])
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('when a logo is set, tells the user to remove the logo instead of a disabled control', async () => {
    render(QrPreview, { props: { text: LONG, qrStyle: { ...defaultStyle(), logo: 'data:image/png;base64,AAAA' } } })
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/remove the logo/i)
    expect(alert).not.toHaveTextContent(/error-correction/i)
  })

  it('recovers when the content becomes valid again', async () => {
    const { rerender } = render(QrPreview, { props: { text: LONG, qrStyle: defaultStyle() } })
    await screen.findByRole('alert')
    await rerender({ text: 'short' })
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(screen.getByRole('img', { name: 'QR code preview' })).toBeInTheDocument()
  })

  it('emits scan=false when the rendered code cannot be read back', async () => {
    vi.mocked(scansBack).mockResolvedValue(false)
    const { emitted } = render(QrPreview, { props: { text: 'hello', qrStyle: defaultStyle() } })
    await waitFor(() => expect(emitted().scan?.at(-1)).toEqual([false]), { timeout: 2000 })
  })

  it('downloads svg and png files with the right names', async () => {
    const names: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download)
    })
    const create = vi.fn(() => 'blob:x')
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() }))

    const wrapper = mount(QrPreview, { props: { text: 'hello', qrStyle: defaultStyle() } })
    await (wrapper.vm as unknown as { download: (e: 'png' | 'svg') => Promise<void> }).download('svg')
    await (wrapper.vm as unknown as { download: (e: 'png' | 'svg') => Promise<void> }).download('png')

    expect(names).toEqual(['qr-code.svg', 'qr-code.png'])
    expect((create.mock.calls[0] as unknown as [Blob])[0].type).toBe('image/svg+xml')
    expect(svgToPng).toHaveBeenCalledWith(expect.stringContaining('<svg'), 300)
  })

  it('does not download while there is an error', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const wrapper = mount(QrPreview, { props: { text: LONG, qrStyle: defaultStyle() } })
    await (wrapper.vm as unknown as { download: (e: 'png' | 'svg') => Promise<void> }).download('svg')
    expect(click).not.toHaveBeenCalled()
  })
})
```

`tests/unit/StylePanel.test.ts` — replace only the first test (`has labeled controls bound to the style`):
```ts
  it('has labeled controls bound to the style', async () => {
    const style = setup()
    await user().selectOptions(screen.getByLabelText('Dot shape'), 'rounded')
    expect(style.dotShape).toBe('rounded')
    await user().selectOptions(screen.getByLabelText('Eye shape'), 'dot')
    expect(style.eyeShape).toBe('dot')
    expect(screen.getByLabelText('Foreground color')).toHaveValue('#000000')
    expect(screen.getByLabelText('Background color')).toHaveValue('#ffffff')
  })
```

`tests/unit/qrOptions.test.ts` (replace the file):
```ts
import { nextTick } from 'vue'
import { defaultStyle } from '~/utils/qrOptions'
import { useQrStyle } from '~/composables/useQrStyle'

describe('defaultStyle', () => {
  it('uses bundled square shapes and no custom svg or logo', () => {
    expect(defaultStyle()).toMatchObject({
      dotShape: 'square', eyeShape: 'square', customDot: null, customEye: null, logo: null, errorLevel: 'M', size: 300,
    })
  })
})

describe('useQrStyle', () => {
  it('exposes a reactive contrast warning', async () => {
    const { style, warning } = useQrStyle()
    expect(warning.value).toBeNull()
    style.fg = '#ffffff'
    style.bg = '#000000'
    await nextTick()
    expect(warning.value).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/QrPreview.test.ts tests/unit/StylePanel.test.ts tests/unit/qrOptions.test.ts`
Expected: FAIL — QrPreview props/labels not yet changed (`Dot shape` label not found, old props).

- [ ] **Step 3: Implement**

`app/components/QrPreview.vue` (replace):
```vue
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { QrCapacityError, buildMatrix } from '~/utils/qr/matrix'
import { renderSvg } from '~/utils/qr/renderSvg'
import { svgToPng } from '~/utils/qr/rasterize'
import { scansBack } from '~/utils/qr/scanCheck'
import { debugLog } from '~/utils/log'
import type { StyleState } from '~/utils/qrOptions'

const props = defineProps<{ text: string | null; qrStyle: StyleState }>()
const emit = defineEmits<{ error: [message: string | null]; scan: [ok: boolean | null] }>()

const svg = ref<string | null>(null)
const error = ref<string | null>(null)
let scanTimer: ReturnType<typeof setTimeout> | undefined
let scanRun = 0

const TOO_LONG = 'This content is too long to fit in a QR code. Shorten it or lower the error-correction level.'
// With a logo the error-correction level is locked to High, so that control cannot help.
const TOO_LONG_WITH_LOGO = 'This content is too long to fit in a QR code with a logo. Remove the logo or shorten the content.'

const previewSrc = computed(() =>
  svg.value ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.value)}` : null,
)

function scheduleScanCheck(markup: string, text: string) {
  const run = scanRun
  scanTimer = setTimeout(async () => {
    try {
      const ok = await scansBack(markup, text)
      debugLog('scan check', { ok })
      if (run === scanRun) emit('scan', ok)
    } catch (e) {
      console.error('[qr-code-builder] scan check failed', { length: text.length }, e)
      if (run === scanRun) emit('scan', null)
    }
  }, 300)
}

function update() {
  clearTimeout(scanTimer)
  scanRun++
  svg.value = null
  error.value = null
  emit('scan', null)
  if (props.text === null) {
    emit('error', null)
    return
  }
  try {
    const level = props.qrStyle.logo ? 'H' : props.qrStyle.errorLevel
    svg.value = renderSvg(buildMatrix(props.text, level), props.qrStyle)
    debugLog('qr rendered', { length: props.text.length, level })
  } catch (e) {
    console.error('[qr-code-builder] render failed', { length: props.text.length }, e)
    error.value =
      e instanceof QrCapacityError
        ? props.qrStyle.logo ? TOO_LONG_WITH_LOGO : TOO_LONG
        : 'Could not render the QR code.'
  }
  emit('error', error.value)
  if (svg.value) scheduleScanCheck(svg.value, props.text)
}

watch(() => [props.text, props.qrStyle], update, { deep: true, immediate: true })
onBeforeUnmount(() => clearTimeout(scanTimer))

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function download(ext: 'png' | 'svg') {
  if (!svg.value || error.value) return
  debugLog('download', ext)
  try {
    const blob = ext === 'svg' ? new Blob([svg.value], { type: 'image/svg+xml' }) : await svgToPng(svg.value, props.qrStyle.size)
    saveBlob(blob, `qr-code.${ext}`)
  } catch (e) {
    console.error('[qr-code-builder] download failed', { ext }, e)
    error.value = 'Download failed. Please try again.'
  }
}
defineExpose({ download })
</script>

<template>
  <div data-testid="qr-preview" class="flex min-h-72 flex-col items-center justify-center gap-3">
    <p v-if="text === null" class="text-slate-600">Fill in the form to see your QR code.</p>
    <p v-else-if="error" role="alert" class="max-w-sm text-center text-red-700">{{ error }}</p>
    <img
      v-else-if="previewSrc"
      :src="previewSrc"
      alt="QR code preview"
      :width="qrStyle.size"
      :height="qrStyle.size"
      class="h-auto max-w-full"
    />
  </div>
</template>
```

`app/components/StylePanel.vue`: replace the grid block that holds the `Dot style` and `Corner style` selects with:
```vue
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label for="style-dots" :class="labelCls">Dot shape</label>
        <select id="style-dots" v-model="style.dotShape" :class="field">
          <option value="square">Square</option>
          <option value="dots">Dots</option>
          <option value="rounded">Rounded</option>
          <option v-if="style.customDot" value="custom">Custom SVG</option>
        </select>
      </div>
      <div>
        <label for="style-eyes" :class="labelCls">Eye shape</label>
        <select id="style-eyes" v-model="style.eyeShape" :class="field">
          <option value="square">Square</option>
          <option value="rounded">Rounded</option>
          <option value="dot">Dot</option>
          <option v-if="style.customEye" value="custom">Custom SVG</option>
        </select>
      </div>
    </div>
```

`app/utils/qrOptions.ts` (replace the file):
```ts
import type { DotShape, EyeShape } from '~/utils/qr/shapes'
import type { SanitizedSvg } from '~/utils/qr/sanitizeSvg'

export type ErrorLevel = 'L' | 'M' | 'Q' | 'H'

export interface StyleState {
  fg: string
  bg: string
  dotShape: DotShape | 'custom'
  eyeShape: EyeShape | 'custom'
  customDot: SanitizedSvg | null
  customEye: SanitizedSvg | null
  size: number
  errorLevel: ErrorLevel
  logo: string | null
}

export const defaultStyle = (): StyleState => ({
  fg: '#000000',
  bg: '#ffffff',
  dotShape: 'square',
  eyeShape: 'square',
  customDot: null,
  customEye: null,
  size: 300,
  errorLevel: 'M',
  logo: null,
})
```

`app/pages/index.vue`: remove the `buildQrOptions` import; replace the `options` computed with
```ts
const payload = computed(() => {
  if (!valid.value) return null
  const text = buildPayload(qrInput.value)
  debugLog('payload built', { type: type.value, length: text.length })
  return text
})
const scanOk = ref<boolean | null>(null)
```
and in the preview section replace the `QrPreview` line with
```vue
        <QrPreview ref="preview" :text="payload" :qr-style="style" @error="renderError = $event" @scan="scanOk = $event" />
        <p v-if="scanOk === false" role="status" class="max-w-sm rounded-md bg-amber-50 p-2 text-sm text-amber-900">
          This design may not scan reliably: a scanner could not read it back. Try a simpler shape or higher contrast.
        </p>
```
(keep `DownloadButtons` as is).

- [ ] **Step 4: Swap the dependency**

Run:
```bash
npm uninstall qr-code-styling
npm install --save-prod jsqr
grep -n '"jsqr"\|"qrcode-generator"\|"qr-code-styling"' package.json
```
Expected: `jsqr` and `qrcode-generator` under `dependencies`, no `qr-code-styling`. If `jsqr` is still under `devDependencies`, move it by hand.

- [ ] **Step 5: Update the e2e locators**

In `tests/e2e/qr.spec.ts` replace both `.locator('canvas')` with `.locator('img')`.

- [ ] **Step 6: Run to verify pass**

Run: `npm test` — Expected: all PASS (the old library-mocking QrPreview tests are gone).
Run: `npm run test:e2e` — Expected: 7 PASS. If a decode fails because of non-integer pixels per module at 300 px, raise the e2e check size rather than loosening the assertion, and ledger the ruling.
Run: `npm run generate` — Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: render QR codes with the own SVG renderer and drop qr-code-styling" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: SVG upload UI for custom eye and dot

**Files:**
- Create: `app/utils/qr/upload.ts`
- Modify: `app/components/StylePanel.vue`
- Test: `tests/unit/upload.test.ts`, `tests/unit/StylePanel.test.ts` (add cases)

**Interfaces:**
- Consumes: `sanitizeSvg`, `MAX_SVG_BYTES`, `SanitizeResult` (Task 3); `StyleState` (Task 6).
- Produces:
  - `readFileText(file: File): Promise<string>`
  - `loadSvgUpload(file: File, idPrefix: string): Promise<SanitizeResult>` — rejects non-SVG (`image/svg+xml` or `.svg` name) with `Please choose an SVG file.`, files over `MAX_SVG_BYTES` with `SVG is larger than 200 KB.` before reading, otherwise sanitizes; read errors give `Could not read the SVG file.` and are logged with `console.error`
  - `StylePanel` labeled file inputs `Custom dot (SVG)` and `Custom eye (SVG)`, buttons `Remove custom dot` / `Remove custom eye`, thumbnails with alt `Custom dot preview` / `Custom eye preview`, per-upload `role="alert"` errors. Uploading sets the matching shape to `'custom'` and remembers the previous bundled shape; removing restores it.

- [ ] **Step 1: Write the failing tests**

`tests/unit/upload.test.ts`:
```ts
import { loadSvgUpload } from '~/utils/qr/upload'
import { MAX_SVG_BYTES } from '~/utils/qr/sanitizeSvg'

const NS = 'xmlns="http://www.w3.org/2000/svg"'
const svgFile = (body: string, name = 'a.svg', type = 'image/svg+xml') => new File([body], name, { type })

describe('loadSvgUpload', () => {
  it('sanitizes a valid svg with the given id prefix', async () => {
    const r = await loadSvgUpload(svgFile(`<svg ${NS} viewBox="0 0 7 7"><rect id="a" width="7" height="7"/></svg>`), 'eye-')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.svg.inner).toContain('id="eye-a"')
  })
  it('accepts a .svg name even when the browser reports no MIME type', async () => {
    const r = await loadSvgUpload(svgFile(`<svg ${NS} viewBox="0 0 7 7"><rect width="7" height="7"/></svg>`, 'x.svg', ''), 'dot-')
    expect(r.ok).toBe(true)
  })
  it('rejects files that are not svg', async () => {
    const r = await loadSvgUpload(new File(['hi'], 'notes.txt', { type: 'text/plain' }), 'eye-')
    expect(r).toEqual({ ok: false, error: 'Please choose an SVG file.' })
  })
  it('rejects oversized files before reading them', async () => {
    const big = svgFile('x'.repeat(MAX_SVG_BYTES + 1))
    const r = await loadSvgUpload(big, 'eye-')
    expect(r).toEqual({ ok: false, error: 'SVG is larger than 200 KB.' })
  })
  it('reports malformed svg', async () => {
    const r = await loadSvgUpload(svgFile('<svg><rect></svg>'), 'eye-')
    expect(r.ok).toBe(false)
  })
})
```

Add these two helpers at the top of `tests/unit/StylePanel.test.ts`, below the imports:
```ts
const SVG = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 7 7">${body}</svg>`
const svgFile = (body: string, name = 'e.svg') => new File([body], name, { type: 'image/svg+xml' })
```
Then add these cases inside the existing `describe` (reusing `setup` and `user`):
```ts
  it('uploads a custom eye, switches to it, shows a thumbnail, and restores the previous shape on remove', async () => {
    const style = setup()
    await user().selectOptions(screen.getByLabelText('Eye shape'), 'rounded')
    await user().upload(screen.getByLabelText('Custom eye (SVG)'), svgFile(SVG('<rect width="7" height="7" fill="#123456"/>')))
    await waitFor(() => expect(style.eyeShape).toBe('custom'))
    expect(style.customEye?.inner).toContain('#123456')
    expect(screen.getByRole('img', { name: 'Custom eye preview' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Custom SVG' })).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: 'Remove custom eye' }))
    expect(style.customEye).toBeNull()
    expect(style.eyeShape).toBe('rounded')
  })

  it('uploads a custom dot independently of the eye', async () => {
    const style = setup()
    await user().upload(screen.getByLabelText('Custom dot (SVG)'), svgFile(SVG('<circle cx="3" cy="3" r="3"/>'), 'd.svg'))
    await waitFor(() => expect(style.dotShape).toBe('custom'))
    expect(style.eyeShape).toBe('square')
    expect(style.customEye).toBeNull()
  })

  it.each([
    ['a non-svg file', new File(['hi'], 'notes.txt', { type: 'text/plain' }), /choose an SVG/i],
    ['a malformed svg', svgFile('<svg><rect></svg>'), /not a valid svg/i],
    ['a non-square svg', svgFile('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 4"><rect width="10" height="4"/></svg>'), /square/i],
  ])('rejects %s with a visible message and keeps the previous shape', async (_label, file, message) => {
    const style = setup()
    await user().upload(screen.getByLabelText('Custom eye (SVG)'), file)
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(style.customEye).toBeNull()
    expect(style.eyeShape).toBe('square')
  })

  it('neutralizes unsafe content in an accepted upload', async () => {
    const style = setup()
    const unsafe = SVG('<script>alert(1)</script><rect onclick="x()" width="7" height="7"/><image href="http://evil.example/x.png"/>')
    await user().upload(screen.getByLabelText('Custom dot (SVG)'), svgFile(unsafe))
    await waitFor(() => expect(style.customDot).not.toBeNull())
    expect(style.customDot!.inner).not.toMatch(/script|onclick|evil\.example/i)
  })
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/upload.test.ts tests/unit/StylePanel.test.ts`
Expected: FAIL — `~/utils/qr/upload` not found; `Custom eye (SVG)` label not found.

- [ ] **Step 3: Implement**

`app/utils/qr/upload.ts`:
```ts
import { MAX_SVG_BYTES, sanitizeSvg, type SanitizeResult } from '~/utils/qr/sanitizeSvg'

export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('File read failed'))
    reader.readAsText(file)
  })
}

export async function loadSvgUpload(file: File, idPrefix: string): Promise<SanitizeResult> {
  if (file.type !== 'image/svg+xml' && !/\.svg$/i.test(file.name)) {
    return { ok: false, error: 'Please choose an SVG file.' }
  }
  if (file.size > MAX_SVG_BYTES) return { ok: false, error: 'SVG is larger than 200 KB.' }
  try {
    return sanitizeSvg(await readFileText(file), idPrefix)
  } catch (e) {
    console.error('[qr-code-builder] svg read failed', { name: file.name, size: file.size, type: file.type }, e)
    return { ok: false, error: 'Could not read the SVG file.' }
  }
}
```

`app/components/StylePanel.vue` — in `<script setup>` add imports `import { loadSvgUpload } from '~/utils/qr/upload'`, `import type { SanitizedSvg } from '~/utils/qr/sanitizeSvg'`, `import type { DotShape, EyeShape } from '~/utils/qr/shapes'` and:
```ts
const dotError = ref<string | null>(null)
const eyeError = ref<string | null>(null)
let prevDot: DotShape = 'square'
let prevEye: EyeShape = 'square'

async function onSvg(kind: 'dot' | 'eye', e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const result = await loadSvgUpload(file, kind === 'dot' ? 'dot-' : 'eye-')
  input.value = ''
  const setError = (message: string | null) => {
    if (kind === 'dot') dotError.value = message
    else eyeError.value = message
  }
  if (!result.ok) {
    setError(result.error)
    return
  }
  setError(null)
  if (kind === 'dot') {
    if (style.value.dotShape !== 'custom') prevDot = style.value.dotShape
    style.value.customDot = result.svg
    style.value.dotShape = 'custom'
  } else {
    if (style.value.eyeShape !== 'custom') prevEye = style.value.eyeShape
    style.value.customEye = result.svg
    style.value.eyeShape = 'custom'
  }
}

function removeSvg(kind: 'dot' | 'eye') {
  if (kind === 'dot') {
    style.value.customDot = null
    style.value.dotShape = prevDot
    dotError.value = null
  } else {
    style.value.customEye = null
    style.value.eyeShape = prevEye
    eyeError.value = null
  }
}

const thumb = (svg: SanitizedSvg) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${svg.viewBox}">${svg.inner}</svg>`,
  )}`
```
and in the template, after the Dot shape / Eye shape grid, add:
```vue
    <div class="space-y-4">
      <div>
        <label for="style-custom-dot" :class="labelCls">Custom dot (SVG)</label>
        <input id="style-custom-dot" type="file" accept="image/svg+xml,.svg" :class="field" @change="onSvg('dot', $event)" />
        <div v-if="style.customDot" class="mt-2 flex items-center gap-3">
          <img :src="thumb(style.customDot)" alt="Custom dot preview" class="h-10 w-10 rounded border border-slate-300 bg-white" />
          <button type="button" class="text-sm text-indigo-700 underline" @click="removeSvg('dot')">Remove custom dot</button>
        </div>
        <p v-if="dotError" role="alert" class="mt-1 text-sm text-red-700">{{ dotError }}</p>
      </div>
      <div>
        <label for="style-custom-eye" :class="labelCls">Custom eye (SVG)</label>
        <input id="style-custom-eye" type="file" accept="image/svg+xml,.svg" :class="field" aria-describedby="style-eye-hint" @change="onSvg('eye', $event)" />
        <p id="style-eye-hint" class="mt-1 text-xs text-slate-600">
          One SVG for the whole 7x7 eye. It is placed at three corners, rotated 0°, -90° and +90°. Your SVG keeps its own colors.
        </p>
        <div v-if="style.customEye" class="mt-2 flex items-center gap-3">
          <img :src="thumb(style.customEye)" alt="Custom eye preview" class="h-10 w-10 rounded border border-slate-300 bg-white" />
          <button type="button" class="text-sm text-indigo-700 underline" @click="removeSvg('eye')">Remove custom eye</button>
        </div>
        <p v-if="eyeError" role="alert" class="mt-1 text-sm text-red-700">{{ eyeError }}</p>
      </div>
    </div>
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/unit/upload.test.ts tests/unit/StylePanel.test.ts` — Expected: all PASS. Then `npm test` — Expected: whole suite PASS.

- [ ] **Step 5: Commit**

```bash
git add app/utils/qr/upload.ts app/components/StylePanel.vue tests/unit/upload.test.ts tests/unit/StylePanel.test.ts
git commit -m "feat: add custom eye and dot SVG upload to the style panel" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: End-to-end tests for SVG shapes

**Files:**
- Create: `tests/e2e/fixtures/eye.svg`, `tests/e2e/fixtures/dot.svg`, `tests/e2e/fixtures/bad-eye.svg`, `tests/e2e/fixtures/malicious.svg`, `tests/e2e/svg-shapes.spec.ts`

**Interfaces:**
- Consumes: the running app (labels `Dot shape`, `Eye shape`, `Custom dot (SVG)`, `Custom eye (SVG)`, `Download PNG`/`Download SVG`, the `role="status"` scan warning, the `role="alert"` upload errors, the `qr-preview` test id).

- [ ] **Step 1: Create the fixtures**

`tests/e2e/fixtures/eye.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 7 7"><rect x="0.5" y="0.5" width="6" height="6" rx="2" fill="none" stroke="#4a148c" stroke-width="1"/><circle cx="3.5" cy="3.5" r="1.6" fill="#4a148c"/></svg>
```

`tests/e2e/fixtures/dot.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9" rx="3" fill="#0b3d91"/></svg>
```

`tests/e2e/fixtures/bad-eye.svg` (a solid block: not a finder pattern, so the code should fail to scan):
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 7 7"><rect width="7" height="7" fill="#000000"/></svg>
```

`tests/e2e/fixtures/malicious.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 7 7" onload="alert('xss')">
  <script>alert('xss')</script>
  <rect x="0.5" y="0.5" width="6" height="6" fill="none" stroke="#000" onclick="alert('xss')"/>
  <image href="http://evil.example/track.png" width="1" height="1"/>
  <foreignObject width="7" height="7"><div xmlns="http://www.w3.org/1999/xhtml">hi</div></foreignObject>
</svg>
```

- [ ] **Step 2: Write the tests** — `tests/e2e/svg-shapes.spec.ts`

```ts
import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { PNG } from 'pngjs'
import jsQR from 'jsqr'

const fixture = (name: string) => `tests/e2e/fixtures/${name}`

async function download(page: Page, name: 'Download PNG' | 'Download SVG') {
  const [d] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name }).click()])
  return (await d.path())!
}
async function decodePng(page: Page): Promise<string | undefined> {
  const png = PNG.sync.read(readFileSync(await download(page, 'Download PNG')))
  return jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data
}
const fillUrl = (page: Page, value: string) => page.getByRole('textbox', { name: 'URL', exact: true }).fill(value)
const preview = (page: Page) => page.getByTestId('qr-preview').locator('img')

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('bundled dot and eye shapes still round-trip', async ({ page }) => {
  await fillUrl(page, 'https://example.com/shapes')
  await page.getByLabel('Dot shape', { exact: true }).selectOption('dots')
  await page.getByLabel('Eye shape', { exact: true }).selectOption('rounded')
  await expect(preview(page)).toBeVisible()
  expect(await decodePng(page)).toBe('https://example.com/shapes')
})

test('accented and emoji text round-trips as UTF-8', async ({ page }) => {
  await page.getByRole('tab', { name: 'Text' }).click()
  const text = 'héllo ñandú 🌍'
  await page.getByRole('textbox', { name: 'Text', exact: true }).fill(text)
  await expect(preview(page)).toBeVisible()
  expect(await decodePng(page)).toBe(text)
})

test('custom eye is rotated 0, -90 and 90 and the code still scans', async ({ page }) => {
  await fillUrl(page, 'https://example.com/eye')
  await page.getByLabel('Custom eye (SVG)').setInputFiles(fixture('eye.svg'))
  await expect(page.getByRole('img', { name: 'Custom eye preview' })).toBeVisible()
  await expect(preview(page)).toBeVisible()

  const svg = readFileSync(await download(page, 'Download SVG'), 'utf8')
  expect(svg).toMatch(/rotate\(0 /)
  expect(svg).toMatch(/rotate\(-90 /)
  expect(svg).toMatch(/rotate\(90 /)
  expect(svg).toContain('#4a148c')
  expect(await decodePng(page)).toBe('https://example.com/eye')
  // the scan check runs ~300 ms after each render; wait it out before asserting no warning
  await page.waitForTimeout(1000)
  await expect(page.getByRole('status')).toHaveCount(0)
})

test('custom dot and custom eye together still scan', async ({ page }) => {
  await fillUrl(page, 'https://example.com/both')
  await page.getByLabel('Custom dot (SVG)').setInputFiles(fixture('dot.svg'))
  await page.getByLabel('Custom eye (SVG)').setInputFiles(fixture('eye.svg'))
  await expect(preview(page)).toBeVisible()
  expect(await decodePng(page)).toBe('https://example.com/both')
})

test('an eye that breaks the finder pattern shows the scan warning but stays downloadable', async ({ page }) => {
  await fillUrl(page, 'https://example.com/bad')
  await page.getByLabel('Custom eye (SVG)').setInputFiles(fixture('bad-eye.svg'))
  await expect(page.getByRole('status')).toContainText(/may not scan reliably/i)
  await expect(page.getByRole('button', { name: 'Download PNG' })).toBeEnabled()
})

test('a malicious svg is neutralized in the preview, the download, and when opened standalone', async ({ page, context }) => {
  let dialogSeen = false
  context.on('page', (p) => p.on('dialog', (d) => { dialogSeen = true; void d.dismiss() }))
  page.on('dialog', (d) => { dialogSeen = true; void d.dismiss() })

  await fillUrl(page, 'https://example.com/safe')
  await page.getByLabel('Custom eye (SVG)').setInputFiles(fixture('malicious.svg'))
  await expect(preview(page)).toBeVisible()

  const path = await download(page, 'Download SVG')
  const svg = readFileSync(path, 'utf8')
  expect(svg).not.toMatch(/<script|onload|onclick|evil\.example|foreignobject/i)

  // Standalone SVG files can run scripts when opened directly; nothing may fire.
  await page.goto(`file://${path}`)
  await page.waitForTimeout(500)
  expect(dialogSeen).toBe(false)
})

test('a non-svg upload is rejected visibly and the shape stays bundled', async ({ page }) => {
  await fillUrl(page, 'https://example.com/x')
  await page.getByLabel('Custom eye (SVG)').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') })
  await expect(page.getByRole('alert')).toContainText(/choose an SVG/i)
  await expect(page.getByLabel('Eye shape', { exact: true })).toHaveValue('square')
})

test('a dense code with custom tiles and a logo still renders', async ({ page }) => {
  await page.getByRole('tab', { name: 'Text' }).click()
  await page.getByRole('textbox', { name: 'Text', exact: true }).fill('0123456789 '.repeat(120))
  await page.getByLabel('Custom dot (SVG)').setInputFiles(fixture('dot.svg'))
  await expect(preview(page)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download PNG' })).toBeEnabled()
})
```

- [ ] **Step 3: Run**

Run: `npm run test:e2e`
Expected: all PASS (7 existing + 8 new). If a decode fails with custom tiles because anti-aliased edges confuse `jsQR` at 300 px, first change the fixtures (e.g. fuller dot shape), then — only if needed — rasterize larger in the test; record a `Ruling:` for whichever you choose. If `bad-eye.svg` is unexpectedly still decoded by `jsQR`, replace the fixture with a design that clearly breaks the 1:1:3:1:1 ring pattern (e.g. a thin diagonal stripe) rather than weakening the assertion.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e
git commit -m "feat: add e2e tests for custom eye and dot SVG shapes" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Documentation

**Files:**
- Create: `docs/architecture/adrs/ADR-own-svg-renderer.md`
- Modify: `docs/architecture/adrs/ADR-qr-library-and-spa.md`, `docs/user-guides/manual.md`, `docs/user-guides/features.md`, `docs/backlog.md`, `docs/changes.md`, `docs/index.md`, `CLAUDE.md`

- [ ] **Step 1: Write the ADR** — `docs/architecture/adrs/ADR-own-svg-renderer.md`

```markdown
# ADR: Own SVG renderer instead of qr-code-styling

**Status:** accepted — 2026-10-06 (supersedes `ADR-qr-library-and-spa.md` for the rendering library; the client-only SPA decision stands)

**Context:** Users want to upload an SVG for the corner "eyes" (rotated 0°, -90°, +90°) and optionally for the data dots. `qr-code-styling` only offers fixed shape presets and no way to supply custom SVG shapes.

**Decision:** Render the code ourselves. `qrcode-generator` provides the module matrix (UTF-8 encoder); a pure `renderSvg` function draws every shape as an SVG `<symbol>` placed with `<use>`. The SVG string is the preview and the SVG download; PNG is that SVG rasterized on a canvas. Uploaded SVGs are sanitized (scripts, handlers, external references removed; ids prefixed) before being embedded. After each render the app decodes its own output with `jsQR` and warns if it cannot be read back.

**Alternatives:** Overlay custom eyes on the `qr-code-styling` output (keeps the library's dot styles but needs its internal layout math and a second pipeline); keep the library and offer more presets only (no custom SVG).

**Consequences:** One pipeline, preview and exports always match, custom shapes are first-class. The library's `classy`, `classy-rounded`, `extra-rounded` dot styles and gradients are dropped (see backlog). We own the logic for module layout, logo clearing and sanitizing, all covered by unit and e2e tests. `jsqr` becomes a runtime dependency (about 40 KB).
```

- [ ] **Step 2: Update the other docs**

- `docs/architecture/adrs/ADR-qr-library-and-spa.md`: change `**Status:** accepted — 2026-10-06` to `**Status:** partially superseded by ADR-own-svg-renderer.md (rendering library); SPA decision accepted — 2026-10-06`.
- `docs/user-guides/features.md`: replace the styling bullet with `- Styling: foreground/background color, dot shape (square, dots, rounded or your own SVG), eye shape (square, rounded, dot or your own SVG), size (200–1000 px), error-correction level, center logo (PNG/JPG/SVG, max 1 MB; forces level H).` and add `- Custom eye: upload one SVG for the whole 7x7 corner eye; it is placed at three corners rotated 0°, -90° and +90°. Custom dot: upload an SVG used for every data dot. Uploaded SVGs keep their own colors, are sanitized, and are limited to 200 KB and square shapes.` and `- Scan check: the app decodes its own output and warns when a design may not scan.`
- `docs/user-guides/manual.md`: add a section "Use your own eye or dot shape" with steps (open **Style**, choose a file under **Custom eye (SVG)** or **Custom dot (SVG)**, check the preview and any scan warning, use **Remove** to go back), a tips list (design the eye in a 7x7 square so it keeps the dark ring / light ring / dark center look scanners expect; use dark colors on the light background; keep dot tiles filling most of the square), and a mermaid diagram:
  ```mermaid
  flowchart LR
    U[SVG upload] --> S[sanitizeSvg]
    S -->|ok| R[renderSvg]
    S -->|error| E[message in Style panel]
    R --> P[Preview and SVG download]
    P --> C[Scan check with jsQR]
    P --> G[PNG via canvas]
  ```
- `docs/backlog.md`: add `## Restore dropped dot styles and gradients` (description: `classy`, `classy-rounded`, `extra-rounded` and color gradients were available with qr-code-styling; redraw as bundled tiles/gradients; value: more built-in looks; consequence: fewer built-in styles, though custom SVG covers any look) and `## Separate outer-frame and inner-dot eye SVGs` (description: allow two uploads or a different eye per corner; value: finer control; consequence: one eye design for all three corners).
- `docs/changes.md`: add under a new `## 2026-10-06 (later)` heading: `- Replaced qr-code-styling with an own SVG renderer; added custom eye and dot SVG upload with sanitizing, UTF-8 payloads and a decode-based scan check.`
- `docs/index.md`: add links to `architecture/adrs/ADR-own-svg-renderer.md`, the new spec and this plan.
- `CLAUDE.md`: in **Architecture** replace the sentence about `qr-code-styling` with: `Rendering is our own: app/utils/qr/ (matrix → renderSvg → rasterize/scanCheck); every shape is an SVG symbol; uploaded SVGs go through sanitizeSvg first. To add a bundled shape edit app/utils/qr/shapes.ts and the selects in StylePanel.`

- [ ] **Step 3: Final verification**

Run: `npm test && npm run test:e2e && npm run generate`
Expected: everything passes.

- [ ] **Step 4: Commit and prepare the PR**

```bash
git add docs CLAUDE.md
git commit -m "docs: document the SVG renderer, custom shapes and ADR" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
Then use `superpowers:finishing-a-development-branch`; per workspace rules the only path is push + open a Pull Request against `main` (never merge locally).
