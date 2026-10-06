import { render, screen, waitFor } from '@testing-library/vue'
import QrPreview from '~/components/QrPreview.vue'

const downloadSpy = vi.fn()

vi.mock('qr-code-styling', () => ({
  default: class {
    constructor(o: { data: string }) {
      if (o.data.length > 100) throw new Error('Code length overflow')
    }
    append() {}
    update(o: { data: string }) {
      if (o.data.length > 100) throw new Error('Code length overflow')
    }
    download(opts: unknown) {
      downloadSpy(opts)
    }
  },
}))

const opts = (data: string) => ({ data, width: 300, height: 300 })

describe('QrPreview', () => {
  beforeEach(() => {
    downloadSpy.mockClear()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('shows a placeholder when there is nothing to render', () => {
    render(QrPreview, { props: { options: null } })
    expect(screen.getByText(/fill in the form/i)).toBeInTheDocument()
  })

  it('shows a clear error when content exceeds QR capacity', async () => {
    const { emitted } = render(QrPreview, { props: { options: opts('x'.repeat(5000)) } })
    expect(await screen.findByRole('alert')).toHaveTextContent(/too long/i)
    await waitFor(() => expect(emitted().error?.at(-1)).toEqual([expect.stringMatching(/too long/i)]))
  })

  it('recovers when the content becomes valid again', async () => {
    const { rerender } = render(QrPreview, { props: { options: opts('x'.repeat(5000)) } })
    await screen.findByRole('alert')
    await rerender({ options: opts('short') })
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })
})
