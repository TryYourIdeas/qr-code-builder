import { reactive } from 'vue'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import StylePanel from '~/components/StylePanel.vue'
import { defaultStyle } from '~/utils/qrOptions'

const SVG = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 7 7">${body}</svg>`
const svgFile = (body: string, name = 'e.svg') => new File([body], name, { type: 'image/svg+xml' })

function setup(warning: string | null = null) {
  const style = reactive(defaultStyle())
  render(StylePanel, { props: { modelValue: style, warning } })
  return style
}
const user = () => userEvent.setup({ applyAccept: false })

describe('StylePanel', () => {
  it('has labeled controls bound to the style', async () => {
    const style = setup()
    await user().selectOptions(screen.getByLabelText('Dot shape'), 'rounded')
    expect(style.dotShape).toBe('rounded')
    await user().selectOptions(screen.getByLabelText('Eye shape'), 'dot')
    expect(style.eyeShape).toBe('dot')
    expect(screen.getByLabelText('Foreground color')).toHaveValue('#000000')
    expect(screen.getByLabelText('Background color')).toHaveValue('#ffffff')
  })

  it('shows the contrast warning as a status message', () => {
    setup('Low contrast: nope')
    expect(screen.getByRole('status')).toHaveTextContent('Low contrast: nope')
  })

  it('rejects a logo that is not an image', async () => {
    const style = setup()
    const file = new File(['hi'], 'notes.txt', { type: 'text/plain' })
    await user().upload(screen.getByLabelText('Logo'), file)
    expect(await screen.findByRole('alert')).toHaveTextContent(/PNG, JPG or SVG/)
    expect(style.logo).toBeNull()
  })

  it('rejects a logo larger than 1 MB', async () => {
    const style = setup()
    const big = new File([new Uint8Array(1024 * 1024 + 1)], 'big.png', { type: 'image/png' })
    await user().upload(screen.getByLabelText('Logo'), big)
    expect(await screen.findByRole('alert')).toHaveTextContent(/1 MB/)
    expect(style.logo).toBeNull()
  })

  it('accepts a valid logo, locks error correction to H and allows removal', async () => {
    const style = setup()
    await user().upload(screen.getByLabelText('Logo'), new File(['x'], 'l.png', { type: 'image/png' }))
    await waitFor(() => expect(style.logo).toMatch(/^data:image\/png/))
    expect(screen.getByLabelText('Error correction')).toBeDisabled()
    await user().click(screen.getByRole('button', { name: 'Remove logo' }))
    expect(style.logo).toBeNull()
  })
  it('uploads a custom eye, switches to it, shows a thumbnail, and restores the previous shape on remove', async () => {
    const style = setup()
    await user().selectOptions(screen.getByLabelText('Eye shape'), 'rounded')
    await user().upload(screen.getByLabelText('Custom eye (SVG)'), svgFile(SVG('<rect width="7" height="7" fill="#123456"/>')))
    await waitFor(() => expect(style.eyeShape).toBe('custom'))
    expect(style.customEye?.inner).toContain('#123456')
    expect(screen.getByRole('img', { name: 'Custom eye preview' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Custom SVG' })).toBeInTheDocument()
    await user().click(screen.getByRole('button', { name: 'Remove custom eye' }))
    expect(style.customEye).toBeNull()
    expect(style.eyeShape).toBe('rounded')
  })

  it('uploads a custom dot independently of the eye', async () => {
    const style = setup()
    await user().upload(screen.getByLabelText('Custom dot (SVG)'), svgFile(SVG('<circle cx="3" cy="3" r="3"/>'), 'd.svg'))
    await waitFor(() => expect(style.dotShape).toBe('custom'))
    expect(style.eyeShape).toBe('square')
    expect(style.customEye).toBeNull()
  })

  it.each([
    ['a non-svg file', new File(['hi'], 'notes.txt', { type: 'text/plain' }), /choose an SVG/i],
    ['a malformed svg', svgFile('<svg><rect></svg>'), /not a valid svg/i],
    ['a non-square svg', svgFile('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 4"><rect width="10" height="4"/></svg>'), /square/i],
  ])('rejects %s with a visible message and keeps the previous shape', async (_label, file, message) => {
    const style = setup()
    await user().upload(screen.getByLabelText('Custom eye (SVG)'), file)
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(style.customEye).toBeNull()
    expect(style.eyeShape).toBe('square')
  })

  it('neutralizes unsafe content in an accepted upload', async () => {
    const style = setup()
    const unsafe = SVG('<script>alert(1)</script><rect onclick="x()" width="7" height="7"/><image href="http://evil.example/x.png"/>')
    await user().upload(screen.getByLabelText('Custom dot (SVG)'), svgFile(unsafe))
    await waitFor(() => expect(style.customDot).not.toBeNull())
    expect(style.customDot!.inner).not.toMatch(/script|onclick|evil\.example/i)
  })
})
