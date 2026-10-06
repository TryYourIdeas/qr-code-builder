import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import DownloadButtons from '~/components/DownloadButtons.vue'

describe('DownloadButtons', () => {
  it('emits the chosen format', async () => {
    const { emitted } = render(DownloadButtons, { props: { disabled: false } })
    await userEvent.click(screen.getByRole('button', { name: 'Download PNG' }))
    await userEvent.click(screen.getByRole('button', { name: 'Download SVG' }))
    expect(emitted().download).toEqual([['png'], ['svg']])
  })
  it('is disabled when there is nothing to download', () => {
    render(DownloadButtons, { props: { disabled: true } })
    expect(screen.getByRole('button', { name: 'Download PNG' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Download SVG' })).toBeDisabled()
  })
})
