import { contrastRatio, contrastWarning } from '~/utils/contrast'

describe('contrast', () => {
  it('computes WCAG ratio', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
    expect(contrastRatio('#12', '#ffffff')).toBeNull()
  })
  it('warns on low contrast', () => {
    expect(contrastWarning('#777777', '#888888')).toMatch(/low contrast/i)
  })
  it('warns on inverted (light on dark) codes', () => {
    expect(contrastWarning('#ffffff', '#000000')).toMatch(/inverted|light-on-dark/i)
  })
  it('returns null for dark on light and for unparsable colors', () => {
    expect(contrastWarning('#000000', '#ffffff')).toBeNull()
    expect(contrastWarning('red', '#ffffff')).toBeNull()
  })
})
