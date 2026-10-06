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
