import { nextTick } from 'vue'
import { defaultStyle } from '~/utils/qrOptions'
import { useQrStyle } from '~/composables/useQrStyle'

describe('defaultStyle', () => {
  it('uses bundled square shapes and no custom svg or logo', () => {
    expect(defaultStyle()).toMatchObject({
      dotShape: 'square', eyeShape: 'square', customDot: null, customEye: null, logo: null, errorLevel: 'M', size: 300,
    })
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
