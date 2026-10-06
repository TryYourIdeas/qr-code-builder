export interface SanitizedSvg {
  viewBox: string
  inner: string
}
export type SanitizeResult = { ok: true; svg: SanitizedSvg } | { ok: false; error: string }
export interface SanitizeOptions {
  /** Maximum number of elements; dot tiles are repeated thousands of times, so they get a low cap. */
  maxNodes?: number
}

export const MAX_SVG_BYTES = 200 * 1024
const MAX_NODES = 2000
const SVG_NS = 'http://www.w3.org/2000/svg'
const XLINK_NS = 'http://www.w3.org/1999/xlink'
const XML_NS = 'http://www.w3.org/XML/1998/namespace'
const XMLNS_NS = 'http://www.w3.org/2000/xmlns/'

// <use> is removed: reference chains expand exponentially and the dot tile is drawn thousands of times.
const FORBIDDEN = new Set([
  'script', 'foreignobject', 'iframe', 'object', 'embed', 'audio', 'video', 'use',
  'set', 'animate', 'animatetransform', 'animatemotion', 'animatecolor',
])
const ROOT_PRESENTATION = ['fill', 'stroke', 'stroke-width', 'fill-rule', 'clip-rule', 'opacity']
const DATA_IMAGE_RE = /^data:image\/(png|jpeg|gif|webp);base64,/i
const URL_REF_RE = /url\(\s*(['"]?)#([^)'"\s]+)\1\s*\)/g
const CSS_RULE_RE = /([^{}]+)\{([^{}]*)\}/g

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

const stripExternalUrls = (css: string) => css.replace(/url\(\s*(?!['"]?#)[^)]*\)/gi, 'none')

// CSS escapes (u\72l, @\69mport) and at-rules could smuggle external fetches past text checks,
// so any stylesheet containing a backslash, "@" or legacy script hooks is dropped entirely.
const unsafeCss = (css: string) => /[\\@]/.test(css) || /expression\s*\(|behavior\s*:/i.test(css)

export function sanitizeSvg(markup: string, idPrefix: string, options: SanitizeOptions = {}): SanitizeResult {
  const maxNodes = options.maxNodes ?? MAX_NODES
  if (new TextEncoder().encode(markup).length > MAX_SVG_BYTES) return fail('SVG is larger than 200 KB.')

  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml')
  const root = doc.documentElement
  if (!root || doc.querySelector('parsererror')) return fail('Not a valid SVG file.')
  if (root.localName.toLowerCase() !== 'svg' || root.namespaceURI !== SVG_NS) return fail('Not an SVG file.')
  if (root.querySelectorAll('*').length > maxNodes) {
    return fail(`SVG is too complex (over ${maxNodes.toLocaleString('en-US')} elements).`)
  }

  const box = readViewBox(root)
  if (!box) return fail('SVG needs a viewBox or numeric width and height.')
  if (Math.abs(box[2] / box[3] - 1) > 0.05) return fail('SVG must be square (width and height within 5%).')

  for (const el of Array.from(root.querySelectorAll('*'))) {
    if (el.namespaceURI !== SVG_NS || FORBIDDEN.has(el.localName.toLowerCase())) el.remove()
  }

  const ids = new Set<string>()
  for (const el of Array.from(root.querySelectorAll('[id]'))) ids.add(el.getAttribute('id')!)
  const renameRefs = (text: string) =>
    text.replace(URL_REF_RE, (m, _q: string, id: string) => (ids.has(id) ? `url(#${idPrefix}${id})` : m))

  const scopeClass = `${idPrefix}scope`
  const renameSelector = (selector: string) =>
    selector
      .replace(/\.([\w-]+)/g, (_m, cls: string) => `.${idPrefix}${cls}`)
      .replace(/#([\w-]+)/g, (m, id: string) => (ids.has(id) ? `#${idPrefix}${id}` : m))
  const scopeCss = (css: string) => {
    const plain = css.replace(/\/\*[\s\S]*?\*\//g, '')
    if (unsafeCss(plain)) return ''
    return plain.replace(CSS_RULE_RE, (_m, selectors: string, body: string) => {
      const scoped = selectors
        .split(',')
        .map((s) => `.${scopeClass} ${renameSelector(s.trim())}`)
        .join(',')
      return `${scoped}{${renameRefs(stripExternalUrls(body))}}`
    })
  }

  for (const el of Array.from(root.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) {
      const ns = attr.namespaceURI
      const local = attr.localName.toLowerCase()
      const drop = () => el.removeAttributeNode(attr)
      if (ns === XMLNS_NS) continue // xmlns / xmlns:x declarations
      if (ns && ns !== XLINK_NS && ns !== XML_NS) { drop(); continue }
      if (local.startsWith('on')) { drop(); continue }
      const value = attr.value
      if (/(java|vb)script:/i.test(value.replace(/[\s\u0000-\u001f]/g, ''))) { drop(); continue }

      if (local === 'href') {
        const v = value.trim()
        if (v.startsWith('#')) {
          if (ids.has(v.slice(1))) attr.value = `#${idPrefix}${v.slice(1)}`
        } else if (!DATA_IMAGE_RE.test(v)) {
          drop()
        }
        continue
      }
      if (local === 'id') { attr.value = idPrefix + value; continue }
      if (local === 'class') {
        attr.value = value.split(/\s+/).filter(Boolean).map((c) => idPrefix + c).join(' ')
        continue
      }
      if (local === 'style') {
        if (unsafeCss(value)) { drop(); continue }
        attr.value = renameRefs(stripExternalUrls(value))
        continue
      }
      if (/url\(/i.test(value) && !onlyLocalUrls(value)) { drop(); continue }
      const renamed = renameRefs(value)
      if (renamed !== value) attr.value = renamed
    }
    if (el.localName.toLowerCase() === 'style') el.textContent = scopeCss(el.textContent ?? '')
  }

  const wrapper = doc.createElementNS(SVG_NS, 'g')
  wrapper.setAttribute('class', scopeClass)
  for (const name of ROOT_PRESENTATION) {
    const v = root.getAttribute(name)
    if (v !== null && !/url\(/i.test(v)) wrapper.setAttribute(name, v)
  }
  wrapper.append(...Array.from(root.childNodes))

  return { ok: true, svg: { viewBox: box.join(' '), inner: new XMLSerializer().serializeToString(wrapper) } }
}
