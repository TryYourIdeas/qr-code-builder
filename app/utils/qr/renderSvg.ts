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

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${px}" height="${px}" viewBox="0 0 ${total} ${total}">` +
    `<defs><symbol id="qrb-dot" viewBox="${esc(dot.viewBox)}">${dot.inner}</symbol>` +
    `<symbol id="qrb-eye" viewBox="${esc(eye.viewBox)}">${eye.inner}</symbol></defs>` +
    `<rect width="${total}" height="${total}" fill="${bg}"/>` +
    `<g${crisp}>${uses.join('')}</g>${eyes.join('')}${logoMarkup}</svg>`
  )
}
