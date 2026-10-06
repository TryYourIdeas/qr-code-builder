import { reactive } from 'vue'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import StylePanel from '~/components/StylePanel.vue'
import { defaultStyle } from '~/utils/qrOptions'

function setup(warning: string | null = null) {
  const style = reactive(defaultStyle())
  render(StylePanel, { props: { modelValue: style, warning } })
  return style
}
const user = () => userEvent.setup({ applyAccept: false })

describe('StylePanel', () => {
  it('has labeled controls bound to the style', async () => {
    const style = setup()
    await user().selectOptions(screen.getByLabelText('Dot style'), 'rounded')
    expect(style.dotStyle).toBe('rounded')
    await user().selectOptions(screen.getByLabelText('Corner style'), 'dot')
    expect(style.cornerStyle).toBe('dot')
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
})
