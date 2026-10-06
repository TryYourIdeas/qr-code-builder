import { buildMatrix } from '~/utils/qr/matrix'
import { renderSvg, QUIET_ZONE } from '~/utils/qr/renderSvg'
import { sanitizeSvg, type SanitizedSvg } from '~/utils/qr/sanitizeSvg'
import { defaultStyle } from '~/utils/qrOptions'

const NS = 'xmlns="http://www.w3.org/2000/svg"'
const m = buildMatrix('hello world', 'M')
const n = m.size
const q = QUIET_ZONE
const base = () => ({ ...defaultStyle() })
// returns [col, row] of every drawn dark module
const dotUses = (svg: string) =>
  [...svg.matchAll(/<use xlink:href="#qrb-dot" x="(\d+)" y="(\d+)"/g)].map((x) => [Number(x[1]) - q, Number(x[2]) - q] as const)
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
    expect([...svg.matchAll(/<use xlink:href="#qrb-eye"/g)]).toHaveLength(3)
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
    expect(uses.some(([col, row]) => inEyeBox(row, col))).toBe(false)
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
    expect(svg).toContain(`<image xlink:href="${logo}"`)
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
