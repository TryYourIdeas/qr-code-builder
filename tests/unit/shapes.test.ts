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
