import { mount } from '@vue/test-utils'
import { render, screen, waitFor } from '@testing-library/vue'
import QrPreview from '~/components/QrPreview.vue'
import { scansBack } from '~/utils/qr/scanCheck'
import { svgToPng } from '~/utils/qr/rasterize'
import { defaultStyle } from '~/utils/qrOptions'
import { buildMatrix } from '~/utils/qr/matrix'

vi.mock('~/utils/qr/scanCheck', () => ({ scansBack: vi.fn().mockResolvedValue(true) }))
vi.mock('~/utils/qr/rasterize', () => ({ svgToPng: vi.fn().mockResolvedValue(new Blob(['png'], { type: 'image/png' })) }))

const LONG = 'x'.repeat(5000)
type Exposed = { download: (e: 'png' | 'svg') => Promise<void> }

describe('QrPreview', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(scansBack).mockResolvedValue(true)
  })
  afterEach(() => vi.restoreAllMocks())

  it('shows a placeholder when there is nothing to render', () => {
    render(QrPreview, { props: { text: null, qrStyle: defaultStyle() } })
    expect(screen.getByText(/fill in the form/i)).toBeInTheDocument()
  })

  it('renders the code as an svg image', () => {
    render(QrPreview, { props: { text: 'hello', qrStyle: defaultStyle() } })
    const img = screen.getByRole('img', { name: 'QR code preview' })
    expect(img.getAttribute('src')).toMatch(/^data:image\/svg\+xml/)
  })

  it('shows a clear error when content exceeds QR capacity and emits it', async () => {
    const { emitted } = render(QrPreview, { props: { text: LONG, qrStyle: defaultStyle() } })
    expect(await screen.findByRole('alert')).toHaveTextContent(/too long/i)
    expect(emitted().error?.at(-1)).toEqual([expect.stringMatching(/too long/i)])
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('when a logo is set, tells the user to remove the logo instead of a disabled control', async () => {
    render(QrPreview, { props: { text: LONG, qrStyle: { ...defaultStyle(), logo: 'data:image/png;base64,AAAA' } } })
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/remove the logo/i)
    expect(alert).not.toHaveTextContent(/error-correction/i)
  })

  it('recovers when the content becomes valid again', async () => {
    const { rerender } = render(QrPreview, { props: { text: LONG, qrStyle: defaultStyle() } })
    await screen.findByRole('alert')
    await rerender({ text: 'short' })
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(screen.getByRole('img', { name: 'QR code preview' })).toBeInTheDocument()
  })

  it('emits scan=false when the rendered code cannot be read back', async () => {
    vi.mocked(scansBack).mockResolvedValue(false)
    const { emitted } = render(QrPreview, { props: { text: 'hello', qrStyle: defaultStyle() } })
    await waitFor(() => expect(emitted().scan?.at(-1)).toEqual([false]), { timeout: 2000 })
  })

  it('rasterizes the scan check large enough for dense codes', async () => {
    const dense = '0123456789 '.repeat(130)
    const size = buildMatrix(dense, 'M').size
    render(QrPreview, { props: { text: dense, qrStyle: defaultStyle() } })
    await waitFor(() => expect(scansBack).toHaveBeenCalled(), { timeout: 2000 })
    const px = vi.mocked(scansBack).mock.calls.at(-1)![2]
    expect(px).toBe(Math.min(1600, (size + 8) * 6))
    expect(px).toBeGreaterThan(400)
  })

  it('downloads svg and png files with the right names', async () => {
    const names: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download)
    })
    const create = vi.fn(() => 'blob:x')
    URL.createObjectURL = create
    URL.revokeObjectURL = vi.fn()

    const wrapper = mount(QrPreview, { props: { text: 'hello', qrStyle: defaultStyle() } })
    await (wrapper.vm as unknown as Exposed).download('svg')
    await (wrapper.vm as unknown as Exposed).download('png')

    expect(names).toEqual(['qr-code.svg', 'qr-code.png'])
    expect((create.mock.calls[0] as unknown as [Blob])[0].type).toBe('image/svg+xml')
    expect(svgToPng).toHaveBeenCalledWith(expect.stringContaining('<svg'), 300)
  })

  it('does not download while there is an error', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const wrapper = mount(QrPreview, { props: { text: LONG, qrStyle: defaultStyle() } })
    await (wrapper.vm as unknown as Exposed).download('svg')
    expect(click).not.toHaveBeenCalled()
  })
})
