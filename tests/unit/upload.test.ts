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
    const r = await loadSvgUpload(svgFile('x'.repeat(MAX_SVG_BYTES + 1)), 'eye-')
    expect(r).toEqual({ ok: false, error: 'SVG is larger than 200 KB.' })
  })
  it('reports malformed svg', async () => {
    const r = await loadSvgUpload(svgFile('<svg><rect></svg>'), 'eye-')
    expect(r.ok).toBe(false)
  })
})
