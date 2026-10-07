import { buildMatrix } from '~/utils/qr/matrix'
import { scansBack } from '~/utils/qr/scanCheck'
import { svgToImageData } from '~/utils/qr/rasterize'
import { matrixToRgba } from './helpers/qr'

vi.mock('~/utils/qr/rasterize', () => ({ svgToImageData: vi.fn() }))

describe('scansBack', () => {
  it('is true when the rendered code decodes to the expected text', async () => {
    vi.mocked(svgToImageData).mockResolvedValue(matrixToRgba(buildMatrix('hello', 'M')) as never)
    expect(await scansBack('<svg/>', 'hello')).toBe(true)
  })
  it('is false when it decodes to something else', async () => {
    vi.mocked(svgToImageData).mockResolvedValue(matrixToRgba(buildMatrix('other', 'M')) as never)
    expect(await scansBack('<svg/>', 'hello')).toBe(false)
  })
  it('is false when nothing can be decoded', async () => {
    const blank = { data: new Uint8ClampedArray(200 * 200 * 4).fill(255), width: 200, height: 200 }
    vi.mocked(svgToImageData).mockResolvedValue(blank as never)
    expect(await scansBack('<svg/>', 'hello')).toBe(false)
  })
})
