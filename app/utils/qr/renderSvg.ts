import type { QrMatrix } from '~/utils/qr/matrix'
import { dotMarkup, eyeMarkup, safeColor } from '~/utils/qr/shapes'
import type { StyleState } from '~/utils/qrOptions'

export type RenderStyle = Pick<StyleState, 'fg' | 'bg' | 'size' | 'dotShape' | 'eyeShape' | 'customDot' | 'customEye' | 'logo' | 'logoPlacement' | 'mixMode'>

export const QUIET_ZONE = 4
export const EYE_SIZE = 7
const LOGO_RATIO = 0.25
const LOGO_PAD = 1
const LOGO_RE = /^data:image\/(png|jpeg|svg\+xml);base64,[A-Za-z0-9+/=]+$/

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

// XOR mode: the logo fills the canvas and the QR spans the middle 2/3 of it (module = 4 units on a 6n canvas).
const XOR_CANVAS = 6
const XOR_MODULE = 4
const INVERT = '-1 0 0 0 1 0 -1 0 0 1 0 0 -1 0 1 0 0 0 1 0'

function renderXorSvg(m: QrMatrix, logo: string, bg: string, px: number): string {
  const n = m.size
  const total = n * XOR_CANVAS
  const offset = n
  let d = ''
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (m.isDark(r, c)) d += `M${offset + c * XOR_MODULE} ${offset + r * XOR_MODULE}h${XOR_MODULE}v${XOR_MODULE}h-${XOR_MODULE}z`
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${px}" height="${px}" viewBox="0 0 ${total} ${total}">` +
    `<defs><g id="qrb-art"><rect width="${total}" height="${total}" fill="${bg}"/>` +
    `<image xlink:href="${esc(logo)}" width="${total}" height="${total}" preserveAspectRatio="xMidYMid slice"/></g>` +
    `<filter id="qrb-invert" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${INVERT}"/></filter>` +
    `<mask id="qrb-xor-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${total}" height="${total}"><path fill="#fff" shape-rendering="crispEdges" d="${d}"/></mask></defs>` +
    `<use xlink:href="#qrb-art"/><use xlink:href="#qrb-art" filter="url(#qrb-invert)" mask="url(#qrb-xor-mask)"/></svg>`
  )
}

const BG_OPACITY = { overlay: 1, translucent: 0.7, faded: 0.9 } as const

// Overlay, translucent and faded modes: the styled code (with its quiet zone and background) sits on the middle 2/3 of the full-size logo.
function renderOverlaySvg(m: QrMatrix, style: RenderStyle, logo: string, bg: string, px: number, bgOpacity: number, knockout: boolean): string {
  const code = m.size + 2 * QUIET_ZONE
  const total = code * 3
  const inner = renderSvg(m, { ...style, logo: null, size: code * 2 }, knockout)
    .replace('<svg ', `<svg x="${code / 2}" y="${code / 2}" `)
    .replace(`fill="${bg}"/>`, `fill="${bg}" fill-opacity="${bgOpacity}"/>`)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${px}" height="${px}" viewBox="0 0 ${total} ${total}">` +
    `<rect width="${total}" height="${total}" fill="${bg}"/>` +
    `<image xlink:href="${esc(logo)}" width="${total}" height="${total}" preserveAspectRatio="xMidYMid slice"/>${inner}</svg>`
  )
}

// knockout cuts the dark modules and eyes out of the background, so whatever lies behind the image shows through them.
export function renderSvg(m: QrMatrix, style: RenderStyle, knockout = false): string {
  const n = m.size
  const q = QUIET_ZONE
  const total = n + 2 * q
  const fg = safeColor(style.fg, '#000000')
  const bg = safeColor(style.bg, '#ffffff')
  const px = Number.isFinite(style.size) ? Math.max(1, Math.round(style.size)) : 300

  const logo = style.logo && LOGO_RE.test(style.logo) ? style.logo : null
  if (logo && style.logoPlacement === 'full') {
    return style.mixMode === 'xor' ? renderXorSvg(m, logo, bg, px) : renderOverlaySvg(m, style, logo, bg, px, BG_OPACITY[style.mixMode], style.mixMode === 'faded')
  }

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
      uses.push(`<use xlink:href="#qrb-dot" x="${c + q}" y="${r + q}" width="1" height="1"/>`)
    }
  }

  const eyes = ([[0, 0, 0], [n - EYE_SIZE, 0, -90], [0, n - EYE_SIZE, 90]] as const).map(([ex, ey, angle]) => {
    const x = ex + q
    const y = ey + q
    return `<use xlink:href="#qrb-eye" x="${x}" y="${y}" width="${EYE_SIZE}" height="${EYE_SIZE}" transform="rotate(${angle} ${x + EYE_SIZE / 2} ${y + EYE_SIZE / 2})"/>`
  })

  const crisp = style.dotShape === 'square' ? ' shape-rendering="crispEdges"' : ''
  const logoMarkup = logo
    ? `<image xlink:href="${esc(logo)}" x="${q + (n - logoSide) / 2}" y="${q + (n - logoSide) / 2}" width="${logoSide}" height="${logoSide}" preserveAspectRatio="xMidYMid meet"/>`
    : ''

  const code = `<g${crisp}>${uses.join('')}</g>${eyes.join('')}`
  // the code, painted black, is subtracted from the background; the filter keeps only its alpha
  const hole =
    `<filter id="qrb-black" filterUnits="userSpaceOnUse" x="0" y="0" width="${total}" height="${total}"><feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0"/></filter>` +
    `<mask id="qrb-hole" maskUnits="userSpaceOnUse" x="0" y="0" width="${total}" height="${total}"><rect width="${total}" height="${total}" fill="#fff"/><g filter="url(#qrb-black)">${code}</g></mask>`

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${px}" height="${px}" viewBox="0 0 ${total} ${total}">` +
    `<defs><symbol id="qrb-dot" viewBox="${esc(dot.viewBox)}">${dot.inner}</symbol>` +
    `<symbol id="qrb-eye" viewBox="${esc(eye.viewBox)}">${eye.inner}</symbol>${knockout ? hole : ''}</defs>` +
    `<rect${knockout ? ' mask="url(#qrb-hole)"' : ''} width="${total}" height="${total}" fill="${bg}"/>` +
    `${knockout ? '' : code}${logoMarkup}</svg>`
  )
}
