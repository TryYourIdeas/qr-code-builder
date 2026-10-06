import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import ContentForm from '~/components/ContentForm.vue'
import { defaultFields } from '~/utils/fields'

describe('ContentForm', () => {
  it('labels every field and emits updates', async () => {
    const onUpdate = vi.fn()
    render(ContentForm, {
      props: { type: 'url', errors: {}, modelValue: defaultFields('url'), 'onUpdate:modelValue': onUpdate },
    })
    const input = screen.getByLabelText(/^URL/)
    await userEvent.type(input, 'a')
    expect(onUpdate).toHaveBeenCalledWith({ url: 'a' })
  })

  it('shows an error only after the field was touched, announced via aria-live', async () => {
    render(ContentForm, {
      props: { type: 'url', errors: { url: 'Enter a URL' }, modelValue: defaultFields('url') },
    })
    const input = screen.getByLabelText(/^URL/)
    expect(screen.queryByText('Enter a URL')).not.toBeInTheDocument()
    await userEvent.click(input)
    await userEvent.tab()
    expect(screen.getByText('Enter a URL')).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    const describedBy = input.getAttribute('aria-describedby')!
    const region = document.getElementById(describedBy)!
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region).toHaveTextContent('Enter a URL')
  })

  it('hides the wifi password when the network is open', () => {
    render(ContentForm, {
      props: { type: 'wifi', errors: {}, modelValue: { ...defaultFields('wifi'), security: 'nopass' } },
    })
    expect(screen.queryByLabelText(/Password/)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Network name/)).toBeInTheDocument()
  })

  it('renders a checkbox and a select for wifi', () => {
    render(ContentForm, { props: { type: 'wifi', errors: {}, modelValue: defaultFields('wifi') } })
    expect(screen.getByRole('checkbox', { name: /Hidden network/ })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /Security/ })).toBeInTheDocument()
  })
})
