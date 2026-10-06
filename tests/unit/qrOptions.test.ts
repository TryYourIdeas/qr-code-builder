import { nextTick } from 'vue'
import { buildQrOptions, defaultStyle } from '~/utils/qrOptions'
import { useQrStyle } from '~/composables/useQrStyle'

describe('buildQrOptions', () => {
  it('maps style to qr-code-styling options', () => {
    const o = buildQrOptions({ ...defaultStyle(), fg: '#112233', bg: '#eeeeee', dotStyle: 'rounded', size: 400 }, 'hello')
    expect(o.data).toBe('hello')
    expect(o.width).toBe(400)
    expect(o.dotsOptions).toMatchObject({ color: '#112233', type: 'rounded' })
    expect(o.backgroundOptions).toMatchObject({ color: '#eeeeee' })
    expect(o.qrOptions?.errorCorrectionLevel).toBe('M')
    expect(o.image).toBeUndefined()
  })
  it('forces error correction H when a logo is present', () => {
    const o = buildQrOptions({ ...defaultStyle(), errorLevel: 'L', logo: 'data:image/png;base64,AAAA' }, 'x')
    expect(o.qrOptions?.errorCorrectionLevel).toBe('H')
    expect(o.image).toBe('data:image/png;base64,AAAA')
  })
  it('maps corner styles', () => {
    expect(buildQrOptions({ ...defaultStyle(), cornerStyle: 'rounded' }, 'x').cornersSquareOptions?.type).toBe('extra-rounded')
    expect(buildQrOptions({ ...defaultStyle(), cornerStyle: 'dot' }, 'x').cornersDotOptions?.type).toBe('dot')
  })
})

describe('useQrStyle', () => {
  it('exposes a reactive contrast warning', async () => {
    const { style, warning } = useQrStyle()
    expect(warning.value).toBeNull()
    style.fg = '#ffffff'
    style.bg = '#000000'
    await nextTick()
    expect(warning.value).not.toBeNull()
  })
})
