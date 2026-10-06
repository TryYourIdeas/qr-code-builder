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
