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
