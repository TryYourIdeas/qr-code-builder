import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import ContentTypeTabs from '~/components/ContentTypeTabs.vue'

function setup(modelValue = 'url') {
  const onUpdate = vi.fn()
  render(ContentTypeTabs, { props: { modelValue, 'onUpdate:modelValue': onUpdate } })
  return onUpdate
}

describe('ContentTypeTabs', () => {
  it('renders an accessible tablist with the selected tab marked', () => {
    setup('phone')
    expect(screen.getByRole('tablist', { name: 'Content type' })).toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(7)
    expect(screen.getByRole('tab', { name: 'Phone' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'URL' })).toHaveAttribute('aria-selected', 'false')
  })
  it('selects on click', async () => {
    const onUpdate = setup()
    await userEvent.click(screen.getByRole('tab', { name: 'Email' }))
    expect(onUpdate).toHaveBeenCalledWith('email')
  })
  it('moves with arrow keys, wrapping around', async () => {
    const onUpdate = setup('url')
    screen.getByRole('tab', { name: 'URL' }).focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(onUpdate).toHaveBeenLastCalledWith('vcard')
    await userEvent.keyboard('{ArrowRight}')
    expect(onUpdate).toHaveBeenCalledTimes(2)
  })
})
