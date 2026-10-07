import { svgToPng, svgToImageData } from '~/utils/qr/rasterize'

let lastImage: { src: string } | null = null

class FakeImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  static fail = false
  set src(value: string) {
    lastImage = { src: value }
    queueMicrotask(() => (FakeImage.fail ? this.onerror?.() : this.onload?.()))
  }
}

describe('rasterize', () => {
  const drawImage = vi.fn()
  const getImageData = vi.fn(() => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }))

  beforeEach(() => {
    FakeImage.fail = false
    lastImage = null
    drawImage.mockClear()
    vi.stubGlobal('Image', FakeImage)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage, getImageData } as never)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => cb(new Blob(['png'], { type: 'image/png' })))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('loads the svg as a data URL and draws it at the requested size into a png', async () => {
    const blob = await svgToPng('<svg xmlns="http://www.w3.org/2000/svg"/>', 300)
    expect(blob.type).toBe('image/png')
    expect(lastImage!.src).toMatch(/^data:image\/svg\+xml/)
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 300, 300)
  })

  it('returns image data for the scan check', async () => {
    const data = await svgToImageData('<svg xmlns="http://www.w3.org/2000/svg"/>', 400)
    expect(getImageData).toHaveBeenCalledWith(0, 0, 400, 400)
    expect(data.width).toBe(1)
  })

  it('rejects when the svg cannot be loaded', async () => {
    FakeImage.fail = true
    await expect(svgToPng('<svg/>', 100)).rejects.toThrow(/rasterize/i)
  })

  it('rejects when png encoding fails', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) => cb(null))
    await expect(svgToPng('<svg/>', 100)).rejects.toThrow(/png/i)
  })

  it('rejects when canvas 2d is unavailable', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    await expect(svgToPng('<svg/>', 100)).rejects.toThrow(/canvas/i)
  })
})
